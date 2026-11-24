package com.trippyplanner.domain.model;

/**
 * A dedicated type rather than {@link java.util.NoSuchElementException}, so that the web adapter's 404 mapping
 * can't swallow unrelated {@code Optional.orElseThrow()} failures.
 */
public final class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(long userId) {
        super("User " + userId + " not found");
    }
}
