from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

password = "admin123"
hashed = pwd_context.hash(password)
print(f"Password: {password}")
print(f"Hashed: {hashed}")

is_valid = pwd_context.verify(password, hashed)
print(f"Is valid: {is_valid}")
