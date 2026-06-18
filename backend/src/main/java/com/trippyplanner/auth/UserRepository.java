package com.trippyplanner.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class UserRepository {
    private final JdbcTemplate jdbc;

    public UserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public long findOrCreate(String email) {
        List<Long> existing = jdbc.queryForList(
            "SELECT id FROM users WHERE email = ?", Long.class, email);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        Long id = jdbc.queryForObject(
            "INSERT INTO users (email) VALUES (?) RETURNING id", Long.class, email);
        return id;
    }

    public Optional<String> findEmailById(long userId) {
        List<String> results = jdbc.queryForList(
            "SELECT email FROM users WHERE id = ?", String.class, userId);
        return results.stream().findFirst();
    }
}
