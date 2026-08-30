package com.fitcoach.payment;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * HMAC-SHA256 over {@code eventId + "." + rawBody}, hex-encoded.
 *
 * The signature covers the raw body, not a parsed object, so a field the
 * application never looks at still can't be tampered with. Comparison is
 * constant-time — a timing oracle on a signature check is a real one.
 */
@Component
public class WebhookSignatureVerifier {

    private final String secret;

    public WebhookSignatureVerifier(@Value("${fitcoach.stripe.webhook-secret}") String secret) {
        this.secret = secret == null ? "" : secret;
    }

    public boolean isValid(String eventId, String rawBody, String providedSignature) {
        if (secret.isBlank() || eventId == null || rawBody == null || providedSignature == null) {
            return false;
        }
        String expected = sign(eventId, rawBody);
        byte[] a = expected.getBytes(StandardCharsets.UTF_8);
        byte[] b = providedSignature.trim().toLowerCase().getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    public String sign(String eventId, String rawBody) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal((eventId + "." + rawBody).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(raw.length * 2);
            for (byte b : raw) hex.append(Character.forDigit((b >> 4) & 0xF, 16))
                                 .append(Character.forDigit(b & 0xF, 16));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC-SHA256 unavailable", e);
        }
    }
}
