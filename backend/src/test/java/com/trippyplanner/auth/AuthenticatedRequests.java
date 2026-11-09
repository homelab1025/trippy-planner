package com.trippyplanner.auth;

import com.trippyplanner.auth.api.CurrentUser;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Stands in for {@link SecurityFilter} in MockMvc slice tests, which don't register the filter.
 */
public final class AuthenticatedRequests {

    private AuthenticatedRequests() {
        throw new AssertionError();
    }

    public static RequestPostProcessor authenticatedAs(long userId) {
        return authenticatedAs(userId, "test-session-token");
    }

    public static RequestPostProcessor authenticatedAs(long userId, String sessionToken) {
        return request -> {
            request.setAttribute(SecurityFilter.CURRENT_USER_ATTRIBUTE, new CurrentUser(userId, sessionToken));
            return request;
        };
    }
}
