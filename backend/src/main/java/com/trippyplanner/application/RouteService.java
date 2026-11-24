package com.trippyplanner.application;

import com.trippyplanner.domain.model.Route;
import com.trippyplanner.domain.model.RouteAccessDeniedException;
import com.trippyplanner.domain.model.RouteNotFoundException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
public class RouteService {

    private final RouteRepository routeRepository;
    private final TokenGenerator tokenGenerator;
    private final Clock clock;

    public RouteService(RouteRepository routeRepository, TokenGenerator tokenGenerator, Clock clock) {
        this.routeRepository = routeRepository;
        this.tokenGenerator = tokenGenerator;
        this.clock = clock;
    }

    public List<Route> list(long userId) {
        return routeRepository.findAllByOwnerId(userId);
    }

    public Route create(long userId, CreateRouteCommand command, String gpxContent) {
        Objects.requireNonNull(gpxContent, "gpxContent");
        Route route = Route.builder()
            .id(UUID.randomUUID())
            .ownerId(userId)
            .name(command.name())
            .avgSpeedKmh(command.avgSpeedKmh())
            .startTime(command.startTime())
            .checkpointsJson(command.checkpointsJson())
            // Postgres stores microseconds; truncating keeps the in-memory value equal to the stored one
            .createdAt(OffsetDateTime.now(clock).truncatedTo(ChronoUnit.MICROS))
            .build();
        return routeRepository.insert(route, gpxContent);
    }

    public Route get(long userId, UUID routeId) {
        return loadOwned(userId, routeId);
    }

    public String getGpx(long userId, UUID routeId) {
        loadOwned(userId, routeId);
        return routeRepository.findGpx(routeId).orElseThrow(() -> new RouteNotFoundException(routeId));
    }

    /**
     * Saves the editable fields of the stored route with {@code command} applied; concurrent edits are
     * last-write-wins.
     */
    public Route update(long userId, UUID routeId, UpdateRouteCommand command) {
        Route current = loadOwned(userId, routeId);
        Route changed = apply(command, current);
        if (changed.equals(current)) {
            return current;
        }
        return routeRepository.update(changed).orElseThrow(() -> new RouteNotFoundException(routeId));
    }

    public void delete(long userId, UUID routeId) {
        loadOwned(userId, routeId);
        routeRepository.delete(routeId);
    }

    public String share(long userId, UUID routeId) {
        Route current = loadOwned(userId, routeId);
        if (current.isPublic()) {
            return current.shareToken();
        }
        return saveSharing(current.share(tokenGenerator.generate())).shareToken();
    }

    public void unshare(long userId, UUID routeId) {
        Route current = loadOwned(userId, routeId);
        if (current.isPublic()) {
            saveSharing(current.unshare());
        }
    }

    public Optional<Route> findByShareToken(String shareToken) {
        return routeRepository.findByShareToken(shareToken);
    }

    public Optional<String> findSharedGpx(String shareToken) {
        return routeRepository.findByShareToken(shareToken).flatMap(route -> routeRepository.findGpx(route.id()));
    }

    private static Route apply(UpdateRouteCommand command, Route route) {
        Route changed = route;
        if (command.name() != null) {
            changed = changed.withName(command.name());
        }
        if (command.avgSpeedKmh() != null) {
            changed = changed.withAvgSpeedKmh(command.avgSpeedKmh());
        }
        if (command.startTime() != null) {
            changed = changed.withStartTime(command.startTime());
        }
        if (command.checkpointsJson() != null) {
            changed = changed.withCheckpointsJson(command.checkpointsJson());
        }
        return changed;
    }

    private Route saveSharing(Route route) {
        return routeRepository.updateSharing(route).orElseThrow(() -> new RouteNotFoundException(route.id()));
    }

    private Route loadOwned(long userId, UUID routeId) {
        Route route = routeRepository.findById(routeId).orElseThrow(() -> new RouteNotFoundException(routeId));
        if (!route.isOwnedBy(userId)) {
            throw new RouteAccessDeniedException(routeId, userId);
        }
        return route;
    }
}
