package com.trippyplanner.routes.adapter.persistence;

import com.trippyplanner.TestFlywayConfig;
import com.trippyplanner.routes.application.RouteRepository;
import com.trippyplanner.routes.domain.model.NewRoute;
import com.trippyplanner.routes.domain.model.RouteSummary;
import com.trippyplanner.routes.domain.model.RouteUpdate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jdbc.test.autoconfigure.DataJdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJdbcTest
@Testcontainers
@Import({JdbcRouteRepository.class, TestFlywayConfig.class})
class JdbcRouteRepositoryTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired RouteRepository routeRepo;
    @Autowired JdbcTemplate jdbc;

    long userId;

    @BeforeEach
    void setup() {
        userId = jdbc.queryForObject(
            "INSERT INTO users (email) VALUES (?) RETURNING id", Long.class, "route-test@example.com");
    }

    private NewRoute sampleRequest() {
        return sampleRequest(null);
    }

    private NewRoute sampleRequest(String checkpointsJson) {
        return new NewRoute("Test Route", "<gpx/>", 20.0, OffsetDateTime.now(), checkpointsJson);
    }

    @Test
    void savesAndRetrievesRoute() {
        var saved = routeRepo.save(userId, sampleRequest());
        assertThat(saved.id()).isNotNull();
        assertThat(saved.name()).isEqualTo("Test Route");
        assertThat(saved.gpxContent()).isEqualTo("<gpx/>");
    }

    @Test
    void listsByUserId() {
        routeRepo.save(userId, sampleRequest());
        routeRepo.save(userId, sampleRequest());
        List<RouteSummary> list = routeRepo.findAllByUserId(userId);
        assertThat(list).hasSize(2);
    }

    @Test
    void updatesNameOnly() {
        var saved = routeRepo.save(userId, sampleRequest());
        var update = new RouteUpdate("Updated Name", null, null, null);
        var updated = routeRepo.update(saved.id(), update).orElseThrow();
        assertThat(updated.name()).isEqualTo("Updated Name");
        assertThat(updated.avgSpeedKmh()).isEqualTo(20.0);
    }

    @Test
    void deletesRoute() {
        var saved = routeRepo.save(userId, sampleRequest());
        routeRepo.delete(saved.id());
        assertThat(routeRepo.findById(saved.id())).isEmpty();
    }

    @Test
    void sharesAndUnsharesRoute() {
        var saved = routeRepo.save(userId, sampleRequest());
        String token = routeRepo.share(saved.id(), "sharetoken123");
        assertThat(routeRepo.findByShareToken(token)).isPresent();

        routeRepo.unshare(saved.id());
        assertThat(routeRepo.findByShareToken(token)).isEmpty();
    }

    @Test
    void shareIsIdempotent() {
        var saved = routeRepo.save(userId, sampleRequest());
        routeRepo.share(saved.id(), "token-first");
        assertThat(routeRepo.findShareToken(saved.id())).contains("token-first");
    }

    @Test
    void findOwnerUserId() {
        var saved = routeRepo.save(userId, sampleRequest());
        assertThat(routeRepo.findOwnerUserId(saved.id())).contains(userId);
        assertThat(routeRepo.findOwnerUserId(UUID.randomUUID())).isEmpty();
    }

    @Test
    void checkpointsJsonIsNullByDefault() {
        var saved = routeRepo.save(userId, sampleRequest());
        assertThat(saved.checkpointsJson()).isNull();
    }

    @Test
    void savesAndRetrievesCheckpointsJson() {
        var req = sampleRequest("[{\"id\":\"end\",\"distanceM\":1000}]");
        var saved = routeRepo.save(userId, req);
        assertThat(saved.checkpointsJson()).isEqualTo("[{\"id\":\"end\",\"distanceM\":1000}]");
        var reloaded = routeRepo.findById(saved.id()).orElseThrow();
        assertThat(reloaded.checkpointsJson()).isEqualTo("[{\"id\":\"end\",\"distanceM\":1000}]");
    }

    @Test
    void updatesCheckpointsJson() {
        var saved = routeRepo.save(userId, sampleRequest());
        var update = new RouteUpdate(null, null, null, "[{\"id\":\"end\",\"distanceM\":500}]");
        var updated = routeRepo.update(saved.id(), update).orElseThrow();
        assertThat(updated.checkpointsJson()).isEqualTo("[{\"id\":\"end\",\"distanceM\":500}]");
    }
}
