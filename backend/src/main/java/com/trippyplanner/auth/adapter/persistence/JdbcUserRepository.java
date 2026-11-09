package com.trippyplanner.auth.adapter.persistence;

import com.trippyplanner.auth.application.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

// Not final: @Repository beans are CGLIB-proxied for exception translation
@Repository
class JdbcUserRepository implements UserRepository {
    private final JdbcTemplate jdbc;

    JdbcUserRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
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

    @Override
    public Optional<String> findEmailById(long userId) {
        List<String> results = jdbc.queryForList(
            "SELECT email FROM users WHERE id = ?", String.class, userId);
        return results.stream().findFirst();
    }
}
