package com.trippyplanner.adapter.web;

import java.util.Objects;

/**
 * The authenticated caller of an HTTP request. Controllers receive it as a method argument on operations the
 * OpenAPI contract marks with {@code bearerAuth}. Public only because the generated API interfaces, in another
 * package, reference it through {@code x-spring-provide-args}.
 */
public record CurrentUser(long userId, String sessionToken) {

    public CurrentUser {
        Objects.requireNonNull(sessionToken, "sessionToken");
    }
}
