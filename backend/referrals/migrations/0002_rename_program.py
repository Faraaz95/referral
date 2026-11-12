from django.db import migrations, models


def rename(apps, schema_editor):
    apps.get_model('referrals', 'ProgramSettings').objects \
        .filter(name='CraftFlow Partner Program').update(name='Referral Program')


class Migration(migrations.Migration):
    dependencies = [('referrals', '0001_initial')]

    operations = [
        migrations.AlterField(
            model_name='programsettings', name='name',
            field=models.CharField(default='Referral Program', max_length=120),
        ),
        migrations.RunPython(rename, migrations.RunPython.noop),
    ]
