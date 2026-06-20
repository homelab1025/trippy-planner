package com.trippyplanner.auth;

import com.trippyplanner.TestFlywayConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jdbc.test.autoconfigure.DataJdbcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@DataJdbcTest
@Testcontainers
@Import({UserRepository.class, SessionRepository.class, TestFlywayConfig.class})
class SessionRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

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
