package com.trippyplanner.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.jdbc.Sql;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

@JdbcTest
@Testcontainers
@Import(UserRepository.class)
class UserRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @Autowired
    UserRepository repo;

    @Test
    void createsNewUserIfEmailUnknown() {
        long id = repo.findOrCreate("new@example.com");
        assertThat(id).isPositive();
    }

    @Test
    void returnsExistingUserIfEmailKnown() {
        long first = repo.findOrCreate("existing@example.com");
        long second = repo.findOrCreate("existing@example.com");
        assertThat(first).isEqualTo(second);
    }

    @Test
    void findsEmailByUserId() {
        long id = repo.findOrCreate("find@example.com");
        assertThat(repo.findEmailById(id)).contains("find@example.com");
    }

    @Test
    void returnsEmptyForUnknownUserId() {
        assertThat(repo.findEmailById(99999L)).isEmpty();
    }
}
