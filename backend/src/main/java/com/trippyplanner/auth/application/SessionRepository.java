package com.trippyplanner.auth.application;

import java.util.Optional;

public interface SessionRepository {

    void save(String token, long userId, long expiryMinutes);

    Optional<Long> findValidUserId(String token);

    Optional<String> findValidSessionTokenByUserId(long userId);

    void delete(String token);
}
