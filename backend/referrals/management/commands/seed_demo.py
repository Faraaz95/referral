"""Local demo data: an admin (admin / admin12345), partners, referrals, commissions and a payout."""
import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from referrals import services
from referrals.models import Commission, CommissionGroup, Profile, Referral

User = get_user_model()


class Command(BaseCommand):
    def handle(self, *args, **opts):
        std, _ = CommissionGroup.objects.get_or_create(name='Standard', defaults={'rate': 10, 'is_default': True})
        gold, _ = CommissionGroup.objects.get_or_create(name='Gold', defaults={'rate': 15, 'bonus_threshold': 5, 'bonus_rate': 5, 'color': '#b45309'})
        CommissionGroup.objects.get_or_create(name='Agency flat fee', defaults={'type': 'fixed', 'fixed_amount': 500, 'color': '#15803d'})
        if not User.objects.filter(username='admin').exists():
            a = User.objects.create_superuser('admin', 'admin@example.com', 'admin12345', first_name='Ada', last_name='Admin')
            Profile.objects.create(user=a, role=Profile.ADMIN)
        rnd = random.Random(7)
        names = [('Sara', 'Khan', gold), ('Leo', 'Martins', std), ('Mia', 'Novak', std), ('Omar', 'Haddad', gold)]
        for first, last, g in names:
            uname = first.lower()
            if User.objects.filter(username=uname).exists():
                continue
            u = User.objects.create_user(uname, f'{uname}@example.com', 'partner12345', first_name=first, last_name=last)
            Profile.objects.create(user=u, group=g, company=f'{last} Studio', clicks=rnd.randint(20, 300))
            for i in range(rnd.randint(4, 9)):
                st = rnd.choice(['new', 'contacted', 'proposal', 'won', 'won', 'lost'])
                est = Decimal(rnd.randrange(2000, 40000, 500))
                r = Referral.objects.create(
                    partner=u, code=u.profile.code, client_name=rnd.choice(['Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Hooli']) + f' {i + 1}',
                    company='', project=rnd.choice(['Website redesign', 'Mobile app', 'CRM setup', 'E-commerce store', 'Brand kit']),
                    estimated_value=est, value=est if st == 'won' else None, status=st,
                    created_at=timezone.now() - timedelta(days=rnd.randint(1, 330)))
                services.sync_commission(r)
                Commission.objects.filter(referral=r).update(created_at=r.created_at)
            for c in Commission.objects.filter(partner=u)[:2]:
                c.status = Commission.APPROVED
                c.save()
        self.stdout.write('Demo data ready: admin / admin12345, partners sara|leo|mia|omar / partner12345')
