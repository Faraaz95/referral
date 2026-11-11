"""Business rules: commissions follow the referral status; payouts bundle approved commissions."""
from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Commission, Payout, Profile, ProgramSettings, Referral


@transaction.atomic
def sync_commission(referral: Referral):
    """Won → one commission for the partner (recalculated while still pending).
    Not won → open (pending/approved, unpaid) commissions are cancelled."""
    open_qs = referral.commissions.filter(status__in=[Commission.PENDING, Commission.APPROVED], payout__isnull=True)
    if referral.status != Referral.WON:
        open_qs.update(status=Commission.CANCELLED)
        if referral.won_at:
            referral.won_at = None
            referral.save(update_fields=['won_at'])
        return None
    if not referral.won_at:
        referral.won_at = timezone.now()
        referral.save(update_fields=['won_at'])
    value = referral.value if referral.value is not None else (referral.estimated_value or Decimal('0'))
    profile, _ = Profile.objects.get_or_create(user=referral.partner)
    # Count won projects before this one, for group bonus tiers
    amount, rate = profile.commission_for(value)
    existing = referral.commissions.exclude(status=Commission.CANCELLED).first()
    if existing:
        if existing.status == Commission.PENDING:
            existing.base_value, existing.rate, existing.amount = value, rate, amount
            existing.save(update_fields=['base_value', 'rate', 'amount'])
        return existing
    return Commission.objects.create(
        partner=referral.partner, referral=referral, base_value=value, rate=rate, amount=amount,
        description=f'{referral.client_name}' + (f' · {referral.project}' if referral.project else ''),
    )


def auto_approve():
    """Pending commissions are approved automatically N days after creation (0 = admins approve by hand)."""
    days = ProgramSettings.get().auto_approve_days
    if days:
        cutoff = timezone.now() - timedelta(days=days)
        Commission.objects.filter(status=Commission.PENDING, created_at__lte=cutoff) \
            .update(status=Commission.APPROVED, approved_at=timezone.now())


def balance(user):
    """What a partner can request now: approved commissions not yet in a payout."""
    return Commission.objects.filter(partner=user, status=Commission.APPROVED, payout__isnull=True) \
        .aggregate(t=Sum('amount'))['t'] or Decimal('0.00')


@transaction.atomic
def request_payout(user, note='', enforce_minimum=True):
    s = ProgramSettings.get()
    commissions = list(Commission.objects.select_for_update()
                       .filter(partner=user, status=Commission.APPROVED, payout__isnull=True))
    total = sum((c.amount for c in commissions), Decimal('0.00'))
    if total <= 0:
        raise ValidationError({'detail': 'There are no approved commissions to pay out yet.'})
    if enforce_minimum and total < s.min_payout:
        raise ValidationError({'detail': f'The minimum payout is {s.currency} {s.min_payout:,.2f}. '
                                         f'Your available balance is {s.currency} {total:,.2f}.'})
    if Payout.objects.filter(partner=user, status__in=[Payout.REQUESTED, Payout.PROCESSING]).exists() and enforce_minimum:
        raise ValidationError({'detail': 'You already have a payout in progress.'})
    profile, _ = Profile.objects.get_or_create(user=user)
    payout = Payout.objects.create(partner=user, amount=total, method=profile.payout_method,
                                   details=profile.payout_details, note=note)
    Commission.objects.filter(pk__in=[c.pk for c in commissions]).update(payout=payout)
    return payout


@transaction.atomic
def set_payout_status(payout: Payout, status, reference=None, note=None):
    if payout.status in (Payout.PAID, Payout.REJECTED):
        raise ValidationError({'detail': f'This payout is already {payout.status}.'})
    payout.status = status
    if reference is not None:
        payout.reference = reference
    if note is not None:
        payout.note = note
    if status == Payout.PAID:
        payout.paid_at = timezone.now()
        payout.commissions.update(status=Commission.PAID)
    elif status == Payout.REJECTED:
        payout.commissions.update(payout=None)
    payout.save()
    return payout
