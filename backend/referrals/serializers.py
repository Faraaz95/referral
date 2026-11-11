from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.db.models import Count, Q, Sum
from rest_framework import serializers

from .models import Commission, CommissionGroup, Payout, Profile, ProgramSettings, Referral

User = get_user_model()


def full_name(u):
    return u.get_full_name() or u.get_username()


def initials(u):
    parts = [p for p in [u.first_name, u.last_name] if p]
    return ''.join(p[0] for p in parts).upper()[:2] or u.get_username()[:2].upper()


class ProgramSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramSettings
        fields = ['name', 'currency', 'min_payout', 'auto_approve_days', 'terms', 'public_signup']


class CommissionGroupSerializer(serializers.ModelSerializer):
    members = serializers.IntegerField(source='member_count', read_only=True, default=0)

    class Meta:
        model = CommissionGroup
        fields = ['id', 'name', 'description', 'type', 'rate', 'fixed_amount', 'bonus_threshold', 'bonus_rate',
                  'color', 'is_default', 'members', 'created_at']
        read_only_fields = ['created_at']


class GroupMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommissionGroup
        fields = ['id', 'name', 'type', 'rate', 'fixed_amount', 'bonus_threshold', 'bonus_rate', 'color']


class ProfileSerializer(serializers.ModelSerializer):
    group = GroupMiniSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = ['role', 'code', 'group', 'custom_rate', 'company', 'phone', 'website', 'payout_method',
                  'payout_details', 'clicks']
        read_only_fields = ['role', 'code', 'group', 'custom_rate', 'clicks']


class MeSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer()
    is_admin = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'name', 'initials', 'is_admin', 'profile']
        read_only_fields = ['username']

    def get_is_admin(self, u):
        return u.is_superuser or getattr(getattr(u, 'profile', None), 'role', '') == Profile.ADMIN

    def get_initials(self, u):
        return initials(u)

    def get_name(self, u):
        return full_name(u)

    def validate_email(self, v):
        if v and User.objects.filter(email__iexact=v).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError('Another account already uses this email.')
        return v

    def update(self, instance, data):
        prof = data.pop('profile', {})
        for k, v in data.items():
            setattr(instance, k, v)
        instance.save()
        for k, v in prof.items():
            setattr(instance.profile, k, v)
        instance.profile.save()
        return instance


def partner_stats(user_ids=None):
    """Per-partner aggregates keyed by user id."""
    qs = User.objects.all()
    if user_ids is not None:
        qs = qs.filter(pk__in=user_ids)
    rows = qs.annotate(
        n_referrals=Count('referrals', distinct=True),
        n_won=Count('referrals', filter=Q(referrals__status=Referral.WON), distinct=True),
    ).values('id', 'n_referrals', 'n_won')
    stats = {r['id']: {'referrals': r['n_referrals'], 'won': r['n_won'], 'earned': 0, 'pending': 0, 'approved': 0, 'paid': 0}
             for r in rows}
    com = Commission.objects.exclude(status=Commission.CANCELLED)
    if user_ids is not None:
        com = com.filter(partner_id__in=user_ids)
    for r in com.values('partner_id', 'status').annotate(total=Sum('amount')):
        s = stats.setdefault(r['partner_id'], {'referrals': 0, 'won': 0, 'earned': 0, 'pending': 0, 'approved': 0, 'paid': 0})
        s[r['status']] = r['total']
        s['earned'] += r['total']
    return stats


class PartnerSerializer(serializers.ModelSerializer):
    """Admin view of a user (partner or admin)."""
    role = serializers.ChoiceField(choices=Profile.ROLES, source='profile.role', default=Profile.PARTNER)
    code = serializers.CharField(source='profile.code', required=False, allow_blank=True, allow_null=True)
    group_id = serializers.PrimaryKeyRelatedField(source='profile.group', queryset=CommissionGroup.objects.all(),
                                                  required=False, allow_null=True)
    group = GroupMiniSerializer(source='profile.group', read_only=True)
    custom_rate = serializers.DecimalField(source='profile.custom_rate', max_digits=6, decimal_places=2,
                                           required=False, allow_null=True)
    company = serializers.CharField(source='profile.company', required=False, allow_blank=True)
    phone = serializers.CharField(source='profile.phone', required=False, allow_blank=True)
    website = serializers.CharField(source='profile.website', required=False, allow_blank=True)
    payout_method = serializers.CharField(source='profile.payout_method', required=False, allow_blank=True)
    payout_details = serializers.CharField(source='profile.payout_details', required=False, allow_blank=True)
    notes = serializers.CharField(source='profile.notes', required=False, allow_blank=True)
    clicks = serializers.IntegerField(source='profile.clicks', read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'name', 'initials', 'is_active', 'date_joined',
                  'last_login', 'role', 'code', 'group_id', 'group', 'custom_rate', 'company', 'phone', 'website',
                  'payout_method', 'payout_details', 'notes', 'clicks', 'password', 'stats']
        read_only_fields = ['date_joined', 'last_login']
        extra_kwargs = {'username': {'required': False}, 'email': {'required': True}}

    def get_name(self, u):
        return full_name(u)

    def get_initials(self, u):
        return initials(u)

    def get_stats(self, u):
        stats = self.context.get('stats')
        if stats is None:
            stats = partner_stats([u.pk])
        return stats.get(u.pk, {'referrals': 0, 'won': 0, 'earned': 0, 'pending': 0, 'approved': 0, 'paid': 0})

    def validate_email(self, v):
        qs = User.objects.filter(email__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Another account already uses this email.')
        return v

    def validate_username(self, v):
        qs = User.objects.filter(username__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('This username is taken.')
        return v

    def validate(self, attrs):
        code = (attrs.get('profile', {}).get('code') or '').strip().upper()
        if code:
            qs = Profile.objects.filter(code=code)
            if self.instance:
                qs = qs.exclude(user=self.instance)
            if qs.exists():
                raise serializers.ValidationError({'code': ['This code is already used by another partner.']})
            if not code.replace('-', '').replace('_', '').isalnum():
                raise serializers.ValidationError({'code': ['Use letters, numbers, - and _ only.']})
        pw = attrs.get('password')
        if pw:
            try:
                validate_password(pw)
            except Exception as e:  # django ValidationError
                raise serializers.ValidationError({'password': list(getattr(e, 'messages', [str(e)]))})
        elif not self.instance:
            raise serializers.ValidationError({'password': ['Set a password for the new account.']})
        return attrs

    @transaction.atomic
    def create(self, data):
        prof = data.pop('profile', {})
        pw = data.pop('password')
        if not data.get('username'):
            data['username'] = data['email'].split('@')[0][:140]
            base, n = data['username'], 1
            while User.objects.filter(username__iexact=data['username']).exists():
                n += 1
                data['username'] = f'{base}{n}'
        user = User(**data)
        user.set_password(pw)
        user.save()
        profile = Profile(user=user)
        for k, v in prof.items():
            setattr(profile, k, v)
        if profile.role == Profile.ADMIN and not prof.get('code'):
            profile.code = None
        profile.save()
        return user

    @transaction.atomic
    def update(self, user, data):
        prof = data.pop('profile', {})
        pw = data.pop('password', None)
        for k, v in data.items():
            setattr(user, k, v)
        if pw:
            user.set_password(pw)
        user.save()
        profile, _ = Profile.objects.get_or_create(user=user)
        for k, v in prof.items():
            setattr(profile, k, v)
        profile.save()
        return user


class UserMiniSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    initials = serializers.SerializerMethodField()
    code = serializers.CharField(source='profile.code', read_only=True, default='')

    class Meta:
        model = User
        fields = ['id', 'name', 'initials', 'email', 'code']

    def get_name(self, u):
        return full_name(u)

    def get_initials(self, u):
        return initials(u)


class ReferralSerializer(serializers.ModelSerializer):
    partner = UserMiniSerializer(read_only=True)
    partner_id = serializers.PrimaryKeyRelatedField(source='partner', queryset=User.objects.all(), required=False, write_only=True)
    commission = serializers.SerializerMethodField()

    class Meta:
        model = Referral
        fields = ['id', 'partner', 'partner_id', 'code', 'source', 'client_name', 'client_email', 'client_phone', 'company',
                  'project', 'description', 'estimated_value', 'value', 'status', 'admin_note', 'created_at',
                  'updated_at', 'won_at', 'commission']
        read_only_fields = ['code', 'source', 'created_at', 'updated_at', 'won_at']

    def get_commission(self, r):
        c = next((c for c in r.commissions.all() if c.status != Commission.CANCELLED), None)
        return {'id': c.id, 'amount': c.amount, 'status': c.status, 'rate': c.rate} if c else None

    def to_representation(self, inst):
        data = super().to_representation(inst)
        req = self.context.get('request')
        if req and not MeSerializer().get_is_admin(req.user):
            data.pop('admin_note', None)
        return data


class CommissionSerializer(serializers.ModelSerializer):
    partner = UserMiniSerializer(read_only=True)
    partner_id = serializers.PrimaryKeyRelatedField(source='partner', queryset=User.objects.all(), write_only=True)
    referral_name = serializers.SerializerMethodField()
    payout_ref = serializers.SerializerMethodField()

    class Meta:
        model = Commission
        fields = ['id', 'partner', 'partner_id', 'referral', 'referral_name', 'description', 'base_value', 'rate',
                  'amount', 'status', 'payout', 'payout_ref', 'created_at', 'approved_at']
        read_only_fields = ['status', 'payout', 'created_at', 'approved_at', 'base_value', 'rate']

    def get_referral_name(self, c):
        if not c.referral:
            return ''
        r = c.referral
        return f'{r.client_name}' + (f' · {r.project}' if r.project else '')

    def get_payout_ref(self, c):
        return f'#{c.payout_id}' if c.payout_id else ''


class PayoutSerializer(serializers.ModelSerializer):
    partner = UserMiniSerializer(read_only=True)
    n_commissions = serializers.IntegerField(source='commissions.count', read_only=True)

    class Meta:
        model = Payout
        fields = ['id', 'partner', 'amount', 'method', 'details', 'reference', 'status', 'note', 'requested_at',
                  'paid_at', 'n_commissions']
        read_only_fields = ['amount', 'status', 'requested_at', 'paid_at', 'method', 'details']
