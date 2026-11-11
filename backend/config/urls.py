from django.contrib import admin
from django.urls import include, path

admin.site.site_header = 'CraftFlow Referrals admin'

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/', include('referrals.urls')),
]
