import { describe, it, expect, vi } from 'vitest';
import { translations } from './translations';
import { t, translateValidation, translateNotification, humanizeKey } from './i18n';
import {
  validateContactAddress,
  validateContact,
  validateSendPayment,
  getPaymentFailureMessage,
} from '@/utils/validation';
import { logger } from '@/utils/logger';

const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe('workflow translations (#292, #295)', () => {
  const english = flatten(translations.en as unknown as Record<string, unknown>).sort();

  it.each(['ar', 'es', 'fr'] as const)('%s has every key that English has, and no extras', (lang) => {
    const keys = flatten(translations[lang] as unknown as Record<string, unknown>).sort();
    expect(keys).toEqual(english);
  });

  it('covers login/register, send, contacts, validation and notifications', () => {
    for (const section of ['auth', 'payment', 'contacts', 'validation', 'notifications']) {
      expect(english.some((k) => k.startsWith(`${section}.`))).toBe(true);
    }
  });

  it.each(['en', 'ar', 'es', 'fr'] as const)('renders no empty or raw-key value in %s', (lang) => {
    for (const key of english) {
      const value = t(lang, key);
      expect(value).not.toBe('');
      expect(value).not.toBe(key);
    }
  });

  it('never renders a raw key path for a missing key', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('es', 'auth.doesNotExist')).toBe('Does not exist');
    expect(humanizeKey('payment.sendPayment')).toBe('Send payment');
  });

  it('translates schema validation messages and leaves unknown ones unchanged', () => {
    expect(translateValidation('es', 'Email is required')).toBe('El correo electrónico es obligatorio');
    expect(translateValidation('fr', 'Password must be at least 8 characters')).toBe(
      'Le mot de passe doit contenir au moins 8 caractères',
    );
    expect(translateValidation('ar', 'Something custom')).toBe('Something custom');
    expect(translateValidation('en', undefined)).toBe('');
  });

  it('translates notifications and falls back to validation or original message (#295)', () => {
    expect(
      translateNotification(
        'es',
        'Invalid email or password. Please check your credentials and try again.',
      ),
    ).toBe('Correo o contraseña no válidos. Comprueba tus credenciales e inténtalo de nuevo.');
    expect(
      translateNotification(
        'fr',
        'Unable to create account. Please check your details and try again.',
      ),
    ).toBe('Impossible de créer le compte. Veuillez vérifier vos informations et réessayer.');
    expect(translateNotification('ar', 'Payment sent successfully!')).toBe('تم إرسال الدفعة بنجاح!');
    // Fallback across sections: notification translated via validation
    expect(translateNotification('es', 'Recipient address is required')).toBe(
      'La dirección del destinatario es obligatoria',
    );
    // Validation translated via notifications
    expect(translateValidation('es', 'Something went wrong. Please try again.')).toBe(
      'Algo salió mal. Por favor, inténtalo de nuevo.',
    );
    // Unknown messages preserved
    expect(translateNotification('es', 'Unique unknown failure')).toBe('Unique unknown failure');
    expect(translateNotification('en', undefined)).toBe('');
  });

  it('localizes validation utilities with optional language parameter (#295)', () => {
    // Address validation
    const invalidAddrEs = validateContactAddress('invalid-stellar-addr', 'es');
    expect(invalidAddrEs).toBe(
      'Introduce una dirección Stellar válida (empieza por G seguida de 55 caracteres alfanuméricos)',
    );

    // Contact form validation
    const contactRes = validateContact({ name: '', address: '', tokenType: '' }, 'es');
    expect(contactRes.isValid).toBe(false);
    expect(contactRes.errors.name).toBe('El nombre es obligatorio');

    // Send payment validation
    const paymentRes = validateSendPayment({ recipientAddress: '', amount: '0', tokenType: 'XLM' }, 'es');
    expect(paymentRes.isValid).toBe(false);
    expect(paymentRes.errors.some((err) => err.includes('Introduce una dirección Stellar válida'))).toBe(true);
    expect(paymentRes.errors.some((err) => err.includes('El importe debe ser mayor que 0'))).toBe(true);
  });

  it('redacts technical details in logs while localizing payment failure message (#295)', () => {
    const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const rawError = new Error('destination_not_activated at stellar core tx 0xdeadbeef');

    const localizedMsg = getPaymentFailureMessage(rawError, 'es');
    expect(localizedMsg).toBe(
      'Este destino Stellar aún no está activado. El destinatario debe activar la cuenta y mantener el saldo mínimo requerido para que este pago tenga éxito.',
    );
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('[payment] error (internal):'),
      expect.anything(),
    );
  });
});
