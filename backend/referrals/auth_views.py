from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status as http
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Profile
from .serializers import MeSerializer

User = get_user_model()


@api_view(['GET'])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    """Sets the csrftoken cookie the frontend sends back on every change."""
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    ident = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    field = 'email__iexact' if '@' in ident else 'username__iexact'
    match = User.objects.filter(**{field: ident}).first()
    user = authenticate(request, username=match.get_username() if match else ident, password=password)
    if not user:
        return Response({'detail': 'That email/username and password don’t match.'}, status=http.HTTP_400_BAD_REQUEST)
    login(request, user)
    if not request.data.get('remember', True):
        request.session.set_expiry(0)
    Profile.objects.get_or_create(user=user, defaults={'role': Profile.ADMIN if user.is_superuser else Profile.PARTNER})
    return Response(MeSerializer(user).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    logout(request)
    return Response({'ok': True})


@api_view(['GET', 'PATCH'])
def me(request):
    Profile.objects.get_or_create(user=request.user, defaults={'role': Profile.ADMIN if request.user.is_superuser else Profile.PARTNER})
    if request.method == 'PATCH':
        ser = MeSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
    return Response(MeSerializer(request.user).data)


@api_view(['POST'])
def change_password(request):
    current = request.data.get('current_password', '')
    new = request.data.get('new_password', '')
    if not request.user.check_password(current):
        return Response({'current_password': ['That’s not your current password.']}, status=http.HTTP_400_BAD_REQUEST)
    if new != request.data.get('confirm_password', ''):
        return Response({'confirm_password': ['The new passwords don’t match.']}, status=http.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new, request.user)
    except ValidationError as e:
        return Response({'new_password': list(e.messages)}, status=http.HTTP_400_BAD_REQUEST)
    request.user.set_password(new)
    request.user.save()
    update_session_auth_hash(request, request.user)
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset(request):
    """Always answers the same way, so it can't be used to discover accounts."""
    email = (request.data.get('email') or '').strip()
    for user in User.objects.filter(email__iexact=email, is_active=True):
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        link = f'{settings.FRONTEND_URL}/reset-password/{uid}/{token}'
        send_mail('Reset your Referral password',
                  f'Hi {user.first_name or user.get_username()},\n\nSet a new password here (link expires in 3 days):\n{link}\n\n'
                  'If you didn’t ask for this, you can ignore this email.',
                  settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(request.data.get('uid', ''))))
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        user = None
    if not user or not default_token_generator.check_token(user, request.data.get('token', '')):
        return Response({'detail': 'This reset link is invalid or has expired. Ask for a new one.'},
                        status=http.HTTP_400_BAD_REQUEST)
    new = request.data.get('new_password', '')
    if new != request.data.get('confirm_password', ''):
        return Response({'confirm_password': ['The passwords don’t match.']}, status=http.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new, user)
    except ValidationError as e:
        return Response({'new_password': list(e.messages)}, status=http.HTTP_400_BAD_REQUEST)
    user.set_password(new)
    user.save()
    return Response({'ok': True})
