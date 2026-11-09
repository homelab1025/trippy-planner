package com.trippyplanner.auth.adapter.persistence;

import com.trippyplanner.auth.application.SessionRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

// Not final: @Repository beans are CGLIB-proxied for exception translation
@Repository
class JdbcSessionRepository implements SessionRepository {
    private final JdbcTemplate jdbc;

    JdbcSessionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void save(String token, long userId, long expiryMinutes) {
        jdbc.update(
            "INSERT INTO sessions (token, user_id, expires_at) " +
            "VALUES (?, ?, now() + (? || ' minutes')::interval)",
            token, userId, expiryMinutes);
    }

    @Override
    public Optional<Long> findValidUserId(String token) {
        List<Long> results = jdbc.queryForList(
            "SELECT user_id FROM sessions WHERE token = ? AND expires_at > now()",
            Long.class, token);
        return results.stream().findFirst();
    }

    @Override
    public Optional<String> findValidSessionTokenByUserId(long userId) {
        List<String> results = jdbc.queryForList(
            "SELECT token FROM sessions WHERE user_id = ? AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
            String.class, userId);
        return results.stream().findFirst();
    }

    @Override
    public void delete(String token) {
        jdbc.update("DELETE FROM sessions WHERE token = ?", token);
    }
}
