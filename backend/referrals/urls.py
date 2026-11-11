from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import auth_views, views

router = DefaultRouter()
router.register('partners', views.PartnerViewSet, basename='partner')
router.register('groups', views.CommissionGroupViewSet, basename='group')
router.register('referrals', views.ReferralViewSet, basename='referral')
router.register('commissions', views.CommissionViewSet, basename='commission')
router.register('payouts', views.PayoutViewSet, basename='payout')

urlpatterns = [
    path('auth/csrf/', auth_views.csrf),
    path('auth/login/', auth_views.login_view),
    path('auth/logout/', auth_views.logout_view),
    path('auth/me/', auth_views.me),
    path('auth/password/change/', auth_views.change_password),
    path('auth/password/reset/', auth_views.password_reset),
    path('auth/password/reset/confirm/', auth_views.password_reset_confirm),
    path('options/', views.options),
    path('settings/', views.program_settings),
    path('dashboard/', views.dashboard),
    path('public/r/<str:code>/', views.public_referral),
    path('', include(router.urls)),
]
