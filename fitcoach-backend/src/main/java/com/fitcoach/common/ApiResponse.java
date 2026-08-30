package com.fitcoach.common;

import java.util.Map;

/** Uniform response envelope for all endpoints. */
public record ApiResponse<T>(boolean ok, String code, String message, T data) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "OK", null, data);
    }
    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, code, message, null);
    }
    public static ApiResponse<Map<String, Object>> error(String code, String message, Map<String, Object> data) {
        return new ApiResponse<>(false, code, message, data);
    }
}
