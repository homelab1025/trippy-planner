package com.trippyplanner.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class SessionRepository {
    private final JdbcTemplate jdbc;

    public SessionRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void save(String token, long userId, long expiryMinutes) {
        jdbc.update(
            "INSERT INTO sessions (token, user_id, expires_at) " +
            "VALUES (?, ?, now() + (? || ' minutes')::interval)",
            token, userId, expiryMinutes);
    }

    public Optional<Long> findValidUserId(String token) {
        List<Long> results = jdbc.queryForList(
            "SELECT user_id FROM sessions WHERE token = ? AND expires_at > now()",
            Long.class, token);
        return results.stream().findFirst();
    }

    public Optional<String> findValidSessionTokenByUserId(long userId) {
        List<String> results = jdbc.queryForList(
            "SELECT token FROM sessions WHERE user_id = ? AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
            String.class, userId);
        return results.stream().findFirst();
    }

    public void delete(String token) {
        jdbc.update("DELETE FROM sessions WHERE token = ?", token);
    }
}
