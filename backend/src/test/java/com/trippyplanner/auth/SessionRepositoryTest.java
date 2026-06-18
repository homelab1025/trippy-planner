package com.trippyplanner.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@JdbcTest
@Testcontainers
@Import({UserRepository.class, SessionRepository.class})
class SessionRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @Autowired
    SessionRepository sessionRepo;

    @Autowired
    UserRepository userRepo;

    long userId;

    @BeforeEach
    void setup() {
        userId = userRepo.findOrCreate("session-test@example.com");
    }

    @Test
    void savesAndFindsValidSession() {
        sessionRepo.save("token123", userId, 43200);
        assertThat(sessionRepo.findValidUserId("token123")).contains(userId);
    }

    @Test
    void returnsEmptyForUnknownToken() {
        assertThat(sessionRepo.findValidUserId("no-such-token")).isEmpty();
    }

    @Test
    void deletesSession() {
        sessionRepo.save("to-delete", userId, 43200);
        sessionRepo.delete("to-delete");
        assertThat(sessionRepo.findValidUserId("to-delete")).isEmpty();
    }
}
