package com.trippyplanner.adapter.persistence;

import com.trippyplanner.application.RouteRepository;
import com.trippyplanner.domain.model.Route;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Not final: @Repository beans are CGLIB-proxied for exception translation
@Repository
class JdbcRouteRepository implements RouteRepository {

    private static final String COLUMNS =
        "id, user_id, name, avg_speed_kmh, start_time, checkpoints_json, is_public, share_token, created_at";

    // is_public and share_token are always written together; the domain derives "public" from the token alone
    private static final RowMapper<Route> MAPPER = (rs, rowNum) -> Route.builder()
        .id(rs.getObject("id", UUID.class))
        .ownerId(rs.getLong("user_id"))
        .name(rs.getString("name"))
        .avgSpeedKmh(rs.getDouble("avg_speed_kmh"))
        .startTime(rs.getObject("start_time", OffsetDateTime.class))
        .checkpointsJson(rs.getString("checkpoints_json"))
        .shareToken(rs.getBoolean("is_public") ? rs.getString("share_token") : null)
        .createdAt(rs.getObject("created_at", OffsetDateTime.class))
        .build();

    private final JdbcTemplate jdbc;

    JdbcRouteRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<Route> findAllByOwnerId(long ownerId) {
        return jdbc.query(
            "SELECT " + COLUMNS + " FROM routes WHERE user_id = ? ORDER BY created_at DESC", MAPPER, ownerId);
    }

    @Override
    public Optional<Route> findById(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM routes WHERE id = ?", MAPPER, id).stream().findFirst();
    }

    @Override
    public Optional<Route> findByShareToken(String shareToken) {
        return jdbc.query(
            "SELECT " + COLUMNS + " FROM routes WHERE share_token = ? AND is_public = true", MAPPER, shareToken)
            .stream().findFirst();
    }

    @Override
    public Optional<String> findGpx(UUID id) {
        return jdbc.queryForList("SELECT gpx_content FROM routes WHERE id = ?", String.class, id)
            .stream().findFirst();
    }

    @Override
    public Route insert(Route route, String gpxContent) {
        jdbc.update(
            "INSERT INTO routes (id, user_id, name, gpx_content, avg_speed_kmh, start_time, checkpoints_json, " +
            "is_public, share_token, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            route.id(), route.ownerId(), route.name(), gpxContent, route.avgSpeedKmh(), route.startTime(),
            route.checkpointsJson(), route.isPublic(), route.shareToken(), route.createdAt());
        return findById(route.id()).orElseThrow();
    }

    @Override
    public Optional<Route> update(Route route) {
        jdbc.update(
            "UPDATE routes SET name = ?, avg_speed_kmh = ?, start_time = ?, checkpoints_json = ?, " +
            "updated_at = now() WHERE id = ?",
            route.name(), route.avgSpeedKmh(), route.startTime(), route.checkpointsJson(), route.id());
        return findById(route.id());
    }

    @Override
    public Optional<Route> updateSharing(Route route) {
        jdbc.update(
            "UPDATE routes SET is_public = ?, share_token = ?, updated_at = now() WHERE id = ?",
            route.isPublic(), route.shareToken(), route.id());
        return findById(route.id());
    }

    @Override
    public void delete(UUID id) {
        jdbc.update("DELETE FROM routes WHERE id = ?", id);
    }
}
