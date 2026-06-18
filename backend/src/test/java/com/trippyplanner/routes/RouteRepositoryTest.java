package com.trippyplanner.routes;

import com.trippyplanner.auth.UserRepository;
import com.trippyplanner.model.CreateRouteRequest;
import com.trippyplanner.model.RouteListItem;
import com.trippyplanner.model.UpdateRouteRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@JdbcTest
@Testcontainers
@Import({RouteRepository.class, UserRepository.class})
class RouteRepositoryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17");

    @Autowired RouteRepository routeRepo;
    @Autowired UserRepository userRepo;

    long userId;

    @BeforeEach
    void setup() {
        userId = userRepo.findOrCreate("route-test@example.com");
    }

    private CreateRouteRequest sampleRequest() {
        var req = new CreateRouteRequest();
        req.setName("Test Route");
        req.setGpxContent("<gpx/>");
        req.setAvgSpeedKmh(20.0);
        req.setStartTime(OffsetDateTime.now());
        return req;
    }

    @Test
    void savesAndRetrievesRoute() {
        var saved = routeRepo.save(userId, sampleRequest());
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getName()).isEqualTo("Test Route");
        assertThat(saved.getGpxContent()).isEqualTo("<gpx/>");
    }

    @Test
    void listsByUserId() {
        routeRepo.save(userId, sampleRequest());
        routeRepo.save(userId, sampleRequest());
        List<RouteListItem> list = routeRepo.findAllByUserId(userId);
        assertThat(list).hasSize(2);
    }

    @Test
    void updatesNameOnly() {
        var saved = routeRepo.save(userId, sampleRequest());
        var update = new UpdateRouteRequest();
        update.setName("Updated Name");
        var updated = routeRepo.update(saved.getId(), update).orElseThrow();
        assertThat(updated.getName()).isEqualTo("Updated Name");
        assertThat(updated.getAvgSpeedKmh()).isEqualTo(20.0);
    }

    @Test
    void deletesRoute() {
        var saved = routeRepo.save(userId, sampleRequest());
        routeRepo.delete(saved.getId());
        assertThat(routeRepo.findById(saved.getId())).isEmpty();
    }

    @Test
    void sharesAndUnsharesRoute() {
        var saved = routeRepo.save(userId, sampleRequest());
        String token = routeRepo.share(saved.getId(), "sharetoken123");
        assertThat(routeRepo.findByShareToken(token)).isPresent();

        routeRepo.unshare(saved.getId());
        assertThat(routeRepo.findByShareToken(token)).isEmpty();
    }

    @Test
    void shareIsIdempotent() {
        var saved = routeRepo.save(userId, sampleRequest());
        routeRepo.share(saved.getId(), "token-first");
        assertThat(routeRepo.findShareToken(saved.getId())).contains("token-first");
    }

    @Test
    void findOwnerUserId() {
        var saved = routeRepo.save(userId, sampleRequest());
        assertThat(routeRepo.findOwnerUserId(saved.getId())).contains(userId);
        assertThat(routeRepo.findOwnerUserId(UUID.randomUUID())).isEmpty();
    }
}
