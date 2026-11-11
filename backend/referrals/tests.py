from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from .models import Commission, CommissionGroup, Payout, Profile, ProgramSettings, Referral

User = get_user_model()


class FlowTests(APITestCase):
    def setUp(self):
        self.group = CommissionGroup.objects.create(name='Gold', rate=Decimal('15'), is_default=True)
        self.admin = User.objects.create_user('boss', 'boss@x.com', 'pw-Secret-123')
        Profile.objects.create(user=self.admin, role=Profile.ADMIN)
        self.partner = User.objects.create_user('pat', 'pat@x.com', 'pw-Secret-123', first_name='Pat')
        Profile.objects.create(user=self.partner)
        s = ProgramSettings.get()
        s.min_payout = Decimal('10')
        s.save()

    def test_partner_gets_code_and_group(self):
        p = self.partner.profile
        self.assertEqual(len(p.code), 8)
        self.assertEqual(p.group, self.group)

    def test_full_flow(self):
        self.client.force_authenticate(self.partner)
        r = self.client.post('/api/referrals/', {'client_name': 'Acme', 'project': 'Website', 'estimated_value': '1000', 'status': 'won'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        ref = Referral.objects.get()
        self.assertEqual(ref.status, 'new')  # partners can't set status
        self.client.force_authenticate(self.admin)
        r = self.client.patch(f'/api/referrals/{ref.id}/', {'status': 'won', 'value': '2000'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        c = Commission.objects.get()
        self.assertEqual(c.amount, Decimal('300.00'))
        # value change recalculates pending commission
        self.client.patch(f'/api/referrals/{ref.id}/', {'value': '3000'}, format='json')
        c.refresh_from_db()
        self.assertEqual(c.amount, Decimal('450.00'))
        self.client.post(f'/api/commissions/{c.id}/approve/')
        self.client.force_authenticate(self.partner)
        r = self.client.post('/api/payouts/', {}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Decimal(r.data['amount']), Decimal('450.00'))
        r = self.client.post(f'/api/payouts/{r.data["id"]}/paid/')
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.admin)
        pid = Payout.objects.get().id
        r = self.client.post(f'/api/payouts/{pid}/paid/', {'reference': 'TX1'}, format='json')
        self.assertEqual(r.data['status'], 'paid')
        c.refresh_from_db()
        self.assertEqual(c.status, 'paid')
        d = self.client.get('/api/dashboard/').data
        self.assertEqual(d['commission']['paid'], Decimal('450.00'))

    def test_partner_isolation_and_public_link(self):
        other = User.objects.create_user('o', 'o@x.com', 'pw')
        Profile.objects.create(user=other)
        Referral.objects.create(partner=other, client_name='Secret')
        self.client.force_authenticate(self.partner)
        self.assertEqual(len(self.client.get('/api/referrals/').data), 0)
        self.assertEqual(self.client.get('/api/partners/').status_code, 403)
        self.client.force_authenticate(None)
        code = self.partner.profile.code
        self.assertEqual(self.client.get(f'/api/public/r/{code.lower()}/').status_code, 200)
        r = self.client.post(f'/api/public/r/{code}/', {'client_name': 'Lead', 'client_email': 'l@x.com'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Referral.objects.filter(partner=self.partner, source='link').count(), 1)
        self.partner.profile.refresh_from_db()
        self.assertEqual(self.partner.profile.clicks, 1)

    def test_admin_creates_partner(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post('/api/partners/', {'email': 'new@x.com', 'first_name': 'New', 'password': 'Very-long-pass-9',
                                                'code': 'new2026', 'group_id': self.group.id, 'role': 'partner'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['code'], 'NEW2026')
        r = self.client.post('/api/partners/', {'email': 'n2@x.com', 'password': 'Very-long-pass-9', 'code': 'NEW2026'}, format='json')
        self.assertEqual(r.status_code, 400)
