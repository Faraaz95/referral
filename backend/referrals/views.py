import csv
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Count, Prefetch, Q, Sum
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, permissions, status as http, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from . import services
from .models import Commission, CommissionGroup, Payout, Profile, ProgramSettings, Referral, new_code
from .serializers import (CommissionGroupSerializer, CommissionSerializer, PartnerSerializer, PayoutSerializer,
                          ProgramSettingsSerializer, ReferralSerializer, full_name, partner_stats)

User = get_user_model()


def is_admin(user):
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    p = getattr(user, 'profile', None)
    return bool(p and p.role == Profile.ADMIN)


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return is_admin(request.user)


class AdminWritePermission(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (request.method in permissions.SAFE_METHODS or is_admin(request.user))


def csv_response(name, header, rows):
    resp = HttpResponse(content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename="{name}"'
    w = csv.writer(resp)
    w.writerow(header)
    w.writerows(rows)
    return resp


# ---------- Options & settings ----------

@api_view(['GET'])
def options(request):
    s = ProgramSettings.get()
    data = {
        'settings': ProgramSettingsSerializer(s).data,
        'referral_statuses': [{'value': v, 'label': l} for v, l in Referral.STATUSES],
        'commission_statuses': [{'value': v, 'label': l} for v, l in Commission.STATUSES],
        'payout_statuses': [{'value': v, 'label': l} for v, l in Payout.STATUSES],
        'payout_methods': [{'value': v, 'label': l} for v, l in Profile._meta.get_field('payout_method').choices],
    }
    if is_admin(request.user):
        data['groups'] = CommissionGroupSerializer(
            CommissionGroup.objects.annotate(member_count=Count('members')), many=True).data
        data['partners'] = [{'id': u.id, 'name': full_name(u), 'code': u.profile.code}
                            for u in User.objects.filter(profile__role=Profile.PARTNER).select_related('profile')
                            .order_by('first_name', 'username')]
    return Response(data)


@api_view(['GET', 'PUT'])
@permission_classes([IsAdmin])
def program_settings(request):
    s = ProgramSettings.get()
    if request.method == 'PUT':
        ser = ProgramSettingsSerializer(s, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
    return Response(ProgramSettingsSerializer(s).data)


# ---------- Dashboard ----------

def monthly(qs, field='created_at', months=12):
    start = (timezone.now().replace(day=1) - timedelta(days=31 * (months - 1))).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    rows = qs.filter(**{f'{field}__gte': start}).annotate(m=TruncMonth(field)).values('m').annotate(total=Sum('amount')).order_by('m')
    by = {r['m'].strftime('%Y-%m'): float(r['total'] or 0) for r in rows}
    out, d = [], start
    for _ in range(months):
        key = d.strftime('%Y-%m')
        out.append({'month': key, 'label': d.strftime('%b'), 'total': by.get(key, 0)})
        d = (d + timedelta(days=32)).replace(day=1)
    return out


@api_view(['GET'])
def dashboard(request):
    services.auto_approve()
    u = request.user
    s = ProgramSettings.get()
    if is_admin(u):
        refs = Referral.objects.all()
        com = Commission.objects.exclude(status=Commission.CANCELLED)
        by_status = dict(refs.values_list('status').annotate(n=Count('id')))
        sums = dict(com.values_list('status').annotate(t=Sum('amount')))
        partners = User.objects.filter(profile__role=Profile.PARTNER)
        stats = partner_stats(list(partners.values_list('id', flat=True)))
        top = sorted(partners.select_related('profile'), key=lambda p: (stats.get(p.id, {}).get('earned', 0), stats.get(p.id, {}).get('referrals', 0)), reverse=True)[:6]
        open_payouts = Payout.objects.filter(status__in=[Payout.REQUESTED, Payout.PROCESSING]).select_related('partner')
        return Response({
            'role': 'admin',
            'partners': partners.filter(is_active=True).count(),
            'clicks': sum(partners.values_list('profile__clicks', flat=True)),
            'referrals': refs.count(),
            'by_status': by_status,
            'won_value': refs.filter(status=Referral.WON).aggregate(t=Sum('value'))['t'] or 0,
            'commission': {k: sums.get(k, 0) for k in ['pending', 'approved', 'paid']},
            'open_payouts': {'count': open_payouts.count(), 'amount': open_payouts.aggregate(t=Sum('amount'))['t'] or 0,
                             'items': PayoutSerializer(open_payouts[:6], many=True).data},
            'monthly': monthly(com),
            'top_partners': [{'id': p.id, 'name': full_name(p), 'code': p.profile.code, **stats.get(p.id, {})} for p in top],
            'recent': ReferralSerializer(refs.select_related('partner__profile').prefetch_related('commissions')[:6],
                                         many=True, context={'request': request}).data,
        })
    profile, _ = Profile.objects.get_or_create(user=u)
    refs = Referral.objects.filter(partner=u)
    com = Commission.objects.filter(partner=u).exclude(status=Commission.CANCELLED)
    sums = dict(com.values_list('status').annotate(t=Sum('amount')))
    won = refs.filter(status=Referral.WON).count()
    total = refs.count()
    open_payout = Payout.objects.filter(partner=u, status__in=[Payout.REQUESTED, Payout.PROCESSING]).first()
    return Response({
        'role': 'partner',
        'code': profile.code,
        'clicks': profile.clicks,
        'referrals': total,
        'won': won,
        'conversion': round(won * 100 / total) if total else 0,
        'by_status': dict(refs.values_list('status').annotate(n=Count('id'))),
        'commission': {k: sums.get(k, 0) for k in ['pending', 'approved', 'paid']},
        'earned': sum(sums.values()) if sums else 0,
        'available': services.balance(u),
        'min_payout': s.min_payout,
        'open_payout': PayoutSerializer(open_payout).data if open_payout else None,
        'monthly': monthly(com),
        'group': {'name': profile.group.name, 'type': profile.group.type, 'rate': profile.group.rate,
                  'fixed_amount': profile.group.fixed_amount, 'bonus_threshold': profile.group.bonus_threshold,
                  'bonus_rate': profile.group.bonus_rate} if profile.group else None,
        'custom_rate': profile.custom_rate,
        'recent': ReferralSerializer(refs.prefetch_related('commissions')[:6], many=True, context={'request': request}).data,
    })


# ---------- Partners (users) ----------

class PartnerViewSet(viewsets.ModelViewSet):
    serializer_class = PartnerSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        qs = User.objects.select_related('profile', 'profile__group').order_by('-date_joined')
        p = self.request.query_params
        if p.get('role'):
            qs = qs.filter(profile__role=p['role'])
        if p.get('group'):
            qs = qs.filter(profile__group_id=p['group'])
        if p.get('q'):
            q = p['q']
            qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(email__icontains=q)
                           | Q(username__icontains=q) | Q(profile__code__icontains=q) | Q(profile__company__icontains=q))
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action == 'list':
            ctx['stats'] = partner_stats()
        return ctx

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            raise ValidationError({'detail': 'You can’t delete your own account.'})
        if user.referrals.exists() or user.commissions.exists() or user.payouts.exists():
            user.is_active = False
            user.save(update_fields=['is_active'])
            return Response({'deactivated': True})
        user.delete()
        return Response(status=http.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def regenerate_code(self, request, pk=None):
        user = self.get_object()
        user.profile.code = new_code()
        user.profile.save()
        return Response(self.get_serializer(user).data)

    @action(detail=False, methods=['get'])
    def export(self, request):
        stats = partner_stats()
        rows = []
        for u in self.get_queryset():
            st = stats.get(u.id, {})
            rows.append([u.id, full_name(u), u.email, u.profile.role, u.profile.code or '', u.profile.group.name if u.profile.group else '',
                         u.profile.custom_rate or '', u.profile.clicks, st.get('referrals', 0), st.get('won', 0),
                         st.get('earned', 0), st.get('paid', 0), 'yes' if u.is_active else 'no'])
        return csv_response('partners.csv', ['id', 'name', 'email', 'role', 'code', 'group', 'custom rate %', 'clicks',
                                             'referrals', 'won', 'earned', 'paid', 'active'], rows)


# ---------- Commission groups ----------

class CommissionGroupViewSet(viewsets.ModelViewSet):
    serializer_class = CommissionGroupSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return CommissionGroup.objects.annotate(member_count=Count('members'))

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        group = self.get_object()
        ids = request.data.get('user_ids') or []
        Profile.objects.filter(user_id__in=ids).update(group=group)
        return Response(self.get_serializer(self.get_queryset().get(pk=group.pk)).data)


# ---------- Referrals / projects ----------

class ReferralViewSet(viewsets.ModelViewSet):
    serializer_class = ReferralSerializer

    def get_queryset(self):
        qs = Referral.objects.select_related('partner__profile').prefetch_related(
            Prefetch('commissions', queryset=Commission.objects.order_by('-created_at')))
        u = self.request.user
        if not is_admin(u):
            qs = qs.filter(partner=u)
        p = self.request.query_params
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('partner') and is_admin(u):
            qs = qs.filter(partner_id=p['partner'])
        if p.get('q'):
            q = p['q']
            qs = qs.filter(Q(client_name__icontains=q) | Q(company__icontains=q) | Q(project__icontains=q)
                           | Q(client_email__icontains=q) | Q(code__icontains=q))
        return qs

    def perform_create(self, ser):
        u = self.request.user
        if is_admin(u):
            partner = ser.validated_data.get('partner')
            if not partner:
                raise ValidationError({'partner_id': ['Choose the partner who referred this project.']})
            obj = ser.save(source='admin', code=getattr(partner.profile, 'code', '') or '')
        else:
            ser.validated_data.pop('status', None)
            ser.validated_data.pop('value', None)
            ser.validated_data.pop('admin_note', None)
            obj = ser.save(partner=u, source='partner', code=u.profile.code or '')
        services.sync_commission(obj)

    def perform_update(self, ser):
        u = self.request.user
        if not is_admin(u):
            if ser.instance.status != Referral.NEW:
                raise PermissionDenied('This referral is already being worked on, so only an admin can change it.')
            for k in ('status', 'value', 'admin_note', 'partner'):
                ser.validated_data.pop(k, None)
        obj = ser.save()
        services.sync_commission(obj)

    def perform_destroy(self, obj):
        u = self.request.user
        if not is_admin(u) and obj.status != Referral.NEW:
            raise PermissionDenied('Only new referrals can be removed.')
        if obj.commissions.filter(status=Commission.PAID).exists():
            raise ValidationError({'detail': 'A paid commission belongs to this project, so it can’t be deleted.'})
        obj.commissions.all().delete()
        obj.delete()

    @action(detail=False, methods=['get'])
    def export(self, request):
        rows = [[r.id, r.created_at.date(), full_name(r.partner), r.code, r.client_name, r.client_email, r.company, r.project,
                 r.get_status_display(), r.estimated_value or '', r.value or '']
                for r in self.get_queryset()]
        return csv_response('referrals.csv', ['id', 'date', 'partner', 'code', 'client', 'email', 'company', 'project',
                                              'status', 'estimated value', 'value'], rows)


# ---------- Commissions ----------

class CommissionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                        mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = CommissionSerializer
    permission_classes = [AdminWritePermission]

    def get_queryset(self):
        services.auto_approve()
        qs = Commission.objects.select_related('partner__profile', 'referral')
        u = self.request.user
        if not is_admin(u):
            qs = qs.filter(partner=u)
        p = self.request.query_params
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('partner') and is_admin(u):
            qs = qs.filter(partner_id=p['partner'])
        return qs

    def perform_create(self, ser):
        # Manual commission: bonus or adjustment (may be negative)
        ser.save(base_value=0, rate=0)

    def perform_destroy(self, obj):
        if obj.status == Commission.PAID or obj.payout_id:
            raise ValidationError({'detail': 'Paid or payout-linked commissions can’t be deleted.'})
        obj.delete()

    def _set(self, request, status, allowed_from):
        c = self.get_object()
        if c.status not in allowed_from or c.payout_id:
            raise ValidationError({'detail': f'A {c.status} commission can’t be changed to {status}.'})
        c.status = status
        c.approved_at = timezone.now() if status == Commission.APPROVED else c.approved_at
        c.save()
        return Response(self.get_serializer(c).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        return self._set(request, Commission.APPROVED, [Commission.PENDING, Commission.CANCELLED])

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        return self._set(request, Commission.CANCELLED, [Commission.PENDING, Commission.APPROVED])

    @action(detail=True, methods=['post'])
    def reopen(self, request, pk=None):
        return self._set(request, Commission.PENDING, [Commission.APPROVED, Commission.CANCELLED])

    @action(detail=False, methods=['post'])
    def approve_all(self, request):
        if not is_admin(request.user):
            raise PermissionDenied()
        n = Commission.objects.filter(status=Commission.PENDING).update(status=Commission.APPROVED, approved_at=timezone.now())
        return Response({'approved': n})

    @action(detail=False, methods=['get'])
    def export(self, request):
        rows = [[c.id, c.created_at.date(), full_name(c.partner), c.description, c.base_value, c.rate, c.amount,
                 c.get_status_display(), c.payout_id or ''] for c in self.get_queryset()]
        return csv_response('commissions.csv', ['id', 'date', 'partner', 'description', 'project value', 'rate %',
                                                'amount', 'status', 'payout'], rows)


# ---------- Payouts ----------

class PayoutViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = PayoutSerializer

    def get_queryset(self):
        qs = Payout.objects.select_related('partner__profile').prefetch_related('commissions')
        u = self.request.user
        if not is_admin(u):
            qs = qs.filter(partner=u)
        p = self.request.query_params
        if p.get('status'):
            qs = qs.filter(status=p['status'])
        if p.get('partner') and is_admin(u):
            qs = qs.filter(partner_id=p['partner'])
        return qs

    def create(self, request):
        """Partners request their approved balance; admins can create a payout for any partner (no minimum)."""
        u = request.user
        if is_admin(u) and request.data.get('partner_id'):
            partner = get_object_or_404(User, pk=request.data['partner_id'])
            payout = services.request_payout(partner, note=request.data.get('note', ''), enforce_minimum=False)
        else:
            payout = services.request_payout(u, note=request.data.get('note', ''))
        return Response(self.get_serializer(payout).data, status=http.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def commissions(self, request, pk=None):
        return Response(CommissionSerializer(self.get_object().commissions.select_related('partner__profile', 'referral'), many=True).data)

    def _status(self, request, status):
        if not is_admin(request.user):
            raise PermissionDenied()
        payout = services.set_payout_status(self.get_object(), status, request.data.get('reference'), request.data.get('note'))
        return Response(self.get_serializer(payout).data)

    @action(detail=True, methods=['post'])
    def processing(self, request, pk=None):
        return self._status(request, Payout.PROCESSING)

    @action(detail=True, methods=['post'])
    def paid(self, request, pk=None):
        return self._status(request, Payout.PAID)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        return self._status(request, Payout.REJECTED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """A partner can withdraw their own request while it's still 'requested'."""
        payout = self.get_object()
        if payout.status != Payout.REQUESTED:
            raise ValidationError({'detail': 'Only a requested payout can be withdrawn.'})
        payout = services.set_payout_status(payout, Payout.REJECTED, note='Withdrawn by partner')
        return Response(self.get_serializer(payout).data)

    @action(detail=False, methods=['get'])
    def export(self, request):
        rows = [[p.id, p.requested_at.date(), full_name(p.partner), p.amount, p.method, p.get_status_display(), p.reference,
                 p.paid_at.date() if p.paid_at else ''] for p in self.get_queryset()]
        return csv_response('payouts.csv', ['id', 'requested', 'partner', 'amount', 'method', 'status', 'reference', 'paid'], rows)


# ---------- Public referral link ----------

class PublicThrottle(AnonRateThrottle):
    rate = '30/hour'


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@throttle_classes([])
def public_referral(request, code):
    profile = Profile.objects.filter(code__iexact=code.strip(), user__is_active=True, role=Profile.PARTNER).select_related('user').first()
    if not profile:
        return Response({'detail': 'This referral code isn’t valid.'}, status=http.HTTP_404_NOT_FOUND)
    s = ProgramSettings.get()
    if request.method == 'GET':
        # Count one visit per browser session
        seen = request.session.get('ref_seen', [])
        if profile.code not in seen:
            Profile.objects.filter(pk=profile.pk).update(clicks=profile.clicks + 1)
            request.session['ref_seen'] = seen + [profile.code]
        return Response({'program': s.name, 'code': profile.code, 'partner': full_name(profile.user),
                         'company': profile.company})
    if not PublicThrottle().allow_request(request, None):
        return Response({'detail': 'Too many submissions. Please try again later.'}, status=http.HTTP_429_TOO_MANY_REQUESTS)
    d = request.data
    errors = {}
    name = (d.get('client_name') or '').strip()
    email = (d.get('client_email') or '').strip()
    if not name:
        errors['client_name'] = ['Please enter your name.']
    if not email or '@' not in email:
        errors['client_email'] = ['Please enter a valid email.']
    if errors:
        return Response(errors, status=http.HTTP_400_BAD_REQUEST)
    est = d.get('estimated_value') or None
    try:
        est = Decimal(str(est)) if est not in (None, '') else None
    except Exception:
        est = None
    Referral.objects.create(
        partner=profile.user, code=profile.code, source='link', client_name=name[:160], client_email=email[:254],
        client_phone=(d.get('client_phone') or '')[:40], company=(d.get('company') or '')[:160],
        project=(d.get('project') or '')[:200], description=(d.get('description') or '')[:5000], estimated_value=est,
    )
    return Response({'ok': True}, status=http.HTTP_201_CREATED)
