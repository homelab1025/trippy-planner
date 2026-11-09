package com.trippyplanner.auth;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * Reads the identity that {@link SecurityFilter} stored on the request. The injected request is a
 * Spring proxy bound to the current thread's request, so this singleton is safe to share.
 */
@Component
final class RequestCurrentUser implements CurrentUser {

    static final String USER_ID_ATTRIBUTE = "userId";
    static final String SESSION_TOKEN_ATTRIBUTE = "sessionToken";

    private final HttpServletRequest request;

    RequestCurrentUser(HttpServletRequest request) {
        this.request = request;
    }

    @Override
    public long userId() {
        return (Long) requireAttribute(USER_ID_ATTRIBUTE);
    }

    @Override
    public String sessionToken() {
        return (String) requireAttribute(SESSION_TOKEN_ATTRIBUTE);
    }

    private Object requireAttribute(String name) {
        Object value = request.getAttribute(name);
        if (value == null) {
            throw new IllegalStateException("No authenticated user on this request");
        }
        return value;
    }
}
