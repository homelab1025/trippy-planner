package com.trippyplanner.auth;

import com.trippyplanner.TestFlywayConfig;
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
@Import({UserRepository.class, TestFlywayConfig.class})
class UserRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

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
