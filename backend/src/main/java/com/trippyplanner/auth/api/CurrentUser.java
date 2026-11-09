package com.trippyplanner.auth.api;

/**
 * The authenticated caller of the current request. Only valid on paths guarded by the auth filter.
 */
public interface CurrentUser {

    long userId();

    String sessionToken();
}
