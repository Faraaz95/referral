"""Referral program: partners with codes, commission groups, referred projects, commissions and payouts."""
import secrets
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # no 0/O, 1/I


def new_code(length=8):
    while True:
        code = ''.join(secrets.choice(CODE_ALPHABET) for _ in range(length))
        if not Profile.objects.filter(code=code).exists():
            return code


class ProgramSettings(models.Model):
    """Single row: program-wide settings."""
    name = models.CharField(max_length=120, default='Referral Program')
    currency = models.CharField(max_length=3, default='USD')
    min_payout = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('50.00'))
    auto_approve_days = models.PositiveIntegerField(default=0, help_text='Approve pending commissions automatically after N days (0 = by hand)')
    terms = models.TextField(blank=True, default='')
    public_signup = models.BooleanField(default=False, help_text='Let people apply to become partners')

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class CommissionGroup(models.Model):
    PERCENT, FIXED = 'percent', 'fixed'
    TYPES = [(PERCENT, 'Percentage of project value'), (FIXED, 'Fixed amount per won project')]

    name = models.CharField(max_length=80, unique=True)
    description = models.CharField(max_length=255, blank=True, default='')
    type = models.CharField(max_length=10, choices=TYPES, default=PERCENT)
    rate = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('10.00'), help_text='Percent, for percentage groups')
    fixed_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    # Optional bonus once a partner passes a number of won projects
    bonus_threshold = models.PositiveIntegerField(default=0, help_text='Won projects needed for the bonus rate (0 = none)')
    bonus_rate = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('0.00'), help_text='Extra percent / amount after the threshold')
    color = models.CharField(max_length=9, default='#2563eb')
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_default:
            CommissionGroup.objects.exclude(pk=self.pk).filter(is_default=True).update(is_default=False)

    def calculate(self, value: Decimal, won_before: int = 0) -> tuple[Decimal, Decimal]:
        """Returns (amount, rate used). For fixed groups the 'rate' is 0."""
        bonus = self.bonus_threshold and won_before >= self.bonus_threshold
        if self.type == self.FIXED:
            amount = self.fixed_amount + (self.bonus_rate if bonus else 0)
            return money(amount), Decimal('0')
        rate = self.rate + (self.bonus_rate if bonus else 0)
        return money(value * rate / 100), rate


def money(v) -> Decimal:
    return Decimal(v).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


class Profile(models.Model):
    ADMIN, PARTNER = 'admin', 'partner'
    ROLES = [(ADMIN, 'Admin'), (PARTNER, 'Partner')]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLES, default=PARTNER)
    code = models.CharField(max_length=32, unique=True, null=True, blank=True)
    group = models.ForeignKey(CommissionGroup, null=True, blank=True, on_delete=models.SET_NULL, related_name='members')
    # Per-partner override: if set, replaces the group's percentage
    custom_rate = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    company = models.CharField(max_length=160, blank=True, default='')
    phone = models.CharField(max_length=40, blank=True, default='')
    website = models.CharField(max_length=200, blank=True, default='')
    payout_method = models.CharField(max_length=20, blank=True, default='bank',
                                     choices=[('bank', 'Bank transfer'), ('paypal', 'PayPal'), ('wise', 'Wise'), ('other', 'Other')])
    payout_details = models.TextField(blank=True, default='', help_text='Account name, IBAN / PayPal email, etc.')
    notes = models.TextField(blank=True, default='', help_text='Admin-only notes')
    clicks = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f'{self.user} ({self.code})'

    @property
    def is_admin(self):
        return self.role == self.ADMIN or self.user.is_superuser

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        elif self.role == self.PARTNER:
            self.code = new_code()
        if self.role == self.PARTNER and not self.group_id:
            self.group = CommissionGroup.objects.filter(is_default=True).first()
        super().save(*args, **kwargs)

    def commission_for(self, value: Decimal) -> tuple[Decimal, Decimal]:
        won_before = Referral.objects.filter(partner=self.user, status=Referral.WON).count()
        if self.custom_rate is not None:
            return money(Decimal(value) * self.custom_rate / 100), self.custom_rate
        if self.group:
            return self.group.calculate(Decimal(value), won_before)
        return Decimal('0.00'), Decimal('0')


class Referral(models.Model):
    """A referred client / project."""
    NEW, CONTACTED, PROPOSAL, WON, LOST = 'new', 'contacted', 'proposal', 'won', 'lost'
    STATUSES = [(NEW, 'New'), (CONTACTED, 'Contacted'), (PROPOSAL, 'Proposal sent'), (WON, 'Won'), (LOST, 'Lost')]
    SOURCES = [('partner', 'Added by partner'), ('link', 'Referral link'), ('admin', 'Added by admin')]

    partner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='referrals')
    code = models.CharField(max_length=32, blank=True, default='')
    source = models.CharField(max_length=10, choices=SOURCES, default='partner')
    client_name = models.CharField(max_length=160)
    client_email = models.EmailField(blank=True, default='')
    client_phone = models.CharField(max_length=40, blank=True, default='')
    company = models.CharField(max_length=160, blank=True, default='')
    project = models.CharField(max_length=200, blank=True, default='', help_text='Project name / what they need')
    description = models.TextField(blank=True, default='')
    estimated_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, help_text='Final contract value')
    status = models.CharField(max_length=12, choices=STATUSES, default=NEW)
    admin_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    won_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.client_name} — {self.project or "project"}'


class Commission(models.Model):
    PENDING, APPROVED, PAID, CANCELLED = 'pending', 'approved', 'paid', 'cancelled'
    STATUSES = [(PENDING, 'Pending'), (APPROVED, 'Approved'), (PAID, 'Paid'), (CANCELLED, 'Cancelled')]

    partner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='commissions')
    referral = models.ForeignKey(Referral, null=True, blank=True, on_delete=models.SET_NULL, related_name='commissions')
    description = models.CharField(max_length=200, blank=True, default='')
    base_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    rate = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUSES, default=PENDING)
    payout = models.ForeignKey('Payout', null=True, blank=True, on_delete=models.SET_NULL, related_name='commissions')
    created_at = models.DateTimeField(default=timezone.now)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']


class Payout(models.Model):
    REQUESTED, PROCESSING, PAID, REJECTED = 'requested', 'processing', 'paid', 'rejected'
    STATUSES = [(REQUESTED, 'Requested'), (PROCESSING, 'Processing'), (PAID, 'Paid'), (REJECTED, 'Rejected')]

    partner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='payouts')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, blank=True, default='')
    details = models.TextField(blank=True, default='')
    reference = models.CharField(max_length=120, blank=True, default='', help_text='Transaction id / reference')
    status = models.CharField(max_length=12, choices=STATUSES, default=REQUESTED)
    note = models.TextField(blank=True, default='')
    requested_at = models.DateTimeField(default=timezone.now)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-requested_at']
