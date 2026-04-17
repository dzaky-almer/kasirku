export interface ValidationResult {
  valid: boolean;
  error?: string;
  normalized?: string;
}

function isValidDomainLabel(label: string) {
  return /^[a-z0-9-]+$/i.test(label) && !label.startsWith("-") && !label.endsWith("-");
}

export function validateRegistrationEmail(email: string): ValidationResult {
  const normalized = email.trim().toLowerCase();

  if (!normalized) {
    return { valid: false, error: "Email wajib diisi." };
  }

  if (normalized.length > 254) {
    return { valid: false, error: "Email terlalu panjang." };
  }

  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return { valid: false, error: "Format email tidak valid." };
  }

  const [localPart, domainPart] = parts;
  if (!localPart || !domainPart) {
    return { valid: false, error: "Format email tidak valid." };
  }

  if (localPart.length > 64) {
    return { valid: false, error: "Bagian depan email terlalu panjang." };
  }

  if (
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(localPart)
  ) {
    return { valid: false, error: "Format email tidak valid." };
  }

  const domainLabels = domainPart.split(".");
  if (
    domainLabels.length < 2 ||
    domainLabels.some((label) => !label) ||
    domainLabels.some((label) => !isValidDomainLabel(label))
  ) {
    return { valid: false, error: "Domain email tidak valid." };
  }

  const topLevelDomain = domainLabels[domainLabels.length - 1];
  if (topLevelDomain.length < 2) {
    return { valid: false, error: "Domain email tidak valid." };
  }

  return { valid: true, normalized };
}

export function normalizePhoneInput(phone: string) {
  return phone.replace(/\D/g, "").slice(0, 15);
}

export function validateWhatsappNumber(phone: string, fieldLabel = "Nomor WhatsApp"): ValidationResult {
  const normalized = normalizePhoneInput(phone);

  if (!normalized) {
    return { valid: false, error: `${fieldLabel} wajib diisi.` };
  }

  if (!normalized.startsWith("62")) {
    return { valid: false, error: `${fieldLabel} harus diawali 62.` };
  }

  if (normalized[2] === "0") {
    return { valid: false, error: `${fieldLabel} tidak boleh memakai 0 setelah 62.` };
  }

  if (normalized.length < 10 || normalized.length > 15) {
    return { valid: false, error: `${fieldLabel} harus 10-15 digit.` };
  }

  if (!/^62\d+$/.test(normalized)) {
    return { valid: false, error: `${fieldLabel} hanya boleh berisi angka.` };
  }

  return { valid: true, normalized };
}
