package com.trippyplanner.auth.api;

import java.util.Objects;

/**
 * The authenticated caller of a request. Controllers receive it as a method argument on operations the
 * OpenAPI contract marks with {@code bearerAuth}.
 */
public record CurrentUser(long userId, String sessionToken) {

    public CurrentUser {
        Objects.requireNonNull(sessionToken, "sessionToken");
    }
}
