package com.fitcoach.common;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** Business-level error with a stable machine-readable code. */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    /** Optional machine-readable payload (e.g. the coach to renew with). */
    private final Map<String, Object> data;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null);
    }

    public ApiException(HttpStatus status, String code, String message, Map<String, Object> data) {
        super(message);
        this.status = status;
        this.code = code;
        this.data = data;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
    public Map<String, Object> getData() { return data; }

    /** Cross-tenant access must look identical to a missing resource. */
    public static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found");
    }
}
