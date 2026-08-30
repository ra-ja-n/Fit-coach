package com.fitcoach.common;

/** Uniform response envelope for all endpoints. */
public record ApiResponse<T>(boolean ok, String code, String message, T data) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "OK", null, data);
    }
    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(false, code, message, null);
    }
}
