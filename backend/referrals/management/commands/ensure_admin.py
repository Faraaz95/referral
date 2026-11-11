"""Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if no admin exists yet (idempotent)."""
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from referrals.models import CommissionGroup, Profile, ProgramSettings


class Command(BaseCommand):
    def handle(self, *args, **opts):
        ProgramSettings.get()
        if not CommissionGroup.objects.exists():
            CommissionGroup.objects.create(name='Standard', description='Default partner commission', rate=10, is_default=True)
        User = get_user_model()
        email, password = os.environ.get('ADMIN_EMAIL'), os.environ.get('ADMIN_PASSWORD')
        if not email or not password:
            return
        if User.objects.filter(is_superuser=True).exists() or Profile.objects.filter(role=Profile.ADMIN).exists():
            return
        user = User.objects.create_superuser(username=email.split('@')[0], email=email, password=password, first_name='Admin')
        Profile.objects.update_or_create(user=user, defaults={'role': Profile.ADMIN, 'code': None})
        self.stdout.write(f'Created admin {email}')
