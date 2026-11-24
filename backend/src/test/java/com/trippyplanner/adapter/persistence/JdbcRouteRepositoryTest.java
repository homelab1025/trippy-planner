package com.trippyplanner.adapter.persistence;

import com.trippyplanner.TestFlywayConfig;
import com.trippyplanner.application.RouteRepository;
import com.trippyplanner.domain.model.Route;
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
import java.time.temporal.ChronoUnit;
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

    private Route sampleRoute() {
        return sampleRoute(null);
    }

    private Route sampleRoute(String checkpointsJson) {
        return Route.builder()
            .id(UUID.randomUUID())
            .ownerId(userId)
            .name("Test Route")
            .avgSpeedKmh(20.0)
            .startTime(OffsetDateTime.parse("2026-01-01T08:00:00Z"))
            .checkpointsJson(checkpointsJson)
            .createdAt(OffsetDateTime.now().truncatedTo(ChronoUnit.MICROS))
            .build();
    }

    @Test
    void insertsAndRetrievesRoute() {
        var route = sampleRoute();
        var saved = routeRepo.insert(route, "<gpx/>");
        assertThat(saved.id()).isEqualTo(route.id());
        assertThat(saved.ownerId()).isEqualTo(userId);
        assertThat(saved.name()).isEqualTo("Test Route");
        assertThat(saved.createdAt()).isEqualTo(route.createdAt());
        assertThat(saved.isPublic()).isFalse();
    }

    @Test
    void storesGpxSeparatelyFromMetadata() {
        var saved = routeRepo.insert(sampleRoute(), "<gpx/>");
        assertThat(routeRepo.findGpx(saved.id())).contains("<gpx/>");
        assertThat(routeRepo.findGpx(UUID.randomUUID())).isEmpty();
    }

    @Test
    void insertReturnsDatabaseNormalisedValues() {
        var saved = routeRepo.insert(sampleRoute().withAvgSpeedKmh(20.555), "<gpx/>");
        assertThat(saved.avgSpeedKmh()).isEqualTo(20.56);
    }

    @Test
    void listsByOwnerId() {
        routeRepo.insert(sampleRoute(), "<gpx/>");
        routeRepo.insert(sampleRoute(), "<gpx/>");
        assertThat(routeRepo.findAllByOwnerId(userId)).hasSize(2);
        assertThat(routeRepo.findAllByOwnerId(userId + 1)).isEmpty();
    }

    @Test
    void updateOverwritesEditableFields() {
        var saved = routeRepo.insert(sampleRoute(), "<gpx/>");
        var updated = routeRepo.update(saved.withName("Updated Name").withCheckpointsJson("[]")).orElseThrow();
        assertThat(updated.name()).isEqualTo("Updated Name");
        assertThat(updated.checkpointsJson()).isEqualTo("[]");
        assertThat(updated.avgSpeedKmh()).isEqualTo(20.0);
        assertThat(routeRepo.findGpx(saved.id())).contains("<gpx/>");
    }

    @Test
    void updateDoesNotWriteSharingState() {
        var saved = routeRepo.insert(sampleRoute(), "<gpx/>");
        routeRepo.updateSharing(saved.share("sharetoken123"));

        // a stale copy loaded before sharing must not revert it
        routeRepo.update(saved.withName("Renamed"));

        assertThat(routeRepo.findByShareToken("sharetoken123")).isPresent();
    }

    @Test
    void updateOfMissingRouteReturnsEmpty() {
        assertThat(routeRepo.update(sampleRoute())).isEmpty();
    }

    @Test
    void deletesRoute() {
        var saved = routeRepo.insert(sampleRoute(), "<gpx/>");
        routeRepo.delete(saved.id());
        assertThat(routeRepo.findById(saved.id())).isEmpty();
    }

    @Test
    void sharesAndUnsharesRoute() {
        var saved = routeRepo.insert(sampleRoute(), "<gpx/>");
        var shared = routeRepo.updateSharing(saved.share("sharetoken123")).orElseThrow();
        assertThat(shared.shareToken()).isEqualTo("sharetoken123");
        assertThat(routeRepo.findByShareToken("sharetoken123")).isPresent();

        routeRepo.updateSharing(shared.unshare());
        assertThat(routeRepo.findByShareToken("sharetoken123")).isEmpty();
        assertThat(routeRepo.findById(saved.id()).orElseThrow().isPublic()).isFalse();
    }

    @Test
    void checkpointsJsonIsNullByDefault() {
        var saved = routeRepo.insert(sampleRoute(), "<gpx/>");
        assertThat(saved.checkpointsJson()).isNull();
    }

    @Test
    void savesAndRetrievesCheckpointsJson() {
        var saved = routeRepo.insert(sampleRoute("[{\"id\":\"end\",\"distanceM\":1000}]"), "<gpx/>");
        var reloaded = routeRepo.findById(saved.id()).orElseThrow();
        assertThat(reloaded.checkpointsJson()).isEqualTo("[{\"id\":\"end\",\"distanceM\":1000}]");
    }
}
