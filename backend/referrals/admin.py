from django.contrib import admin

from .models import Commission, CommissionGroup, Payout, Profile, ProgramSettings, Referral

admin.site.register(ProgramSettings)


@admin.register(CommissionGroup)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'type', 'rate', 'fixed_amount', 'is_default']


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'code', 'group', 'custom_rate', 'clicks']
    search_fields = ['user__username', 'user__email', 'code']


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ['client_name', 'project', 'partner', 'status', 'value', 'created_at']
    list_filter = ['status']


@admin.register(Commission)
class CommissionAdmin(admin.ModelAdmin):
    list_display = ['partner', 'description', 'amount', 'status', 'payout', 'created_at']
    list_filter = ['status']


@admin.register(Payout)
class PayoutAdmin(admin.ModelAdmin):
    list_display = ['partner', 'amount', 'status', 'requested_at', 'paid_at']
    list_filter = ['status']
