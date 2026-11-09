package com.trippyplanner.routes.adapter.persistence;

import com.trippyplanner.routes.application.RouteRepository;
import com.trippyplanner.routes.domain.model.NewRoute;
import com.trippyplanner.routes.domain.model.Route;
import com.trippyplanner.routes.domain.model.RouteSummary;
import com.trippyplanner.routes.domain.model.RouteUpdate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.*;

// Not final: @Repository beans are CGLIB-proxied for exception translation
@Repository
class JdbcRouteRepository implements RouteRepository {
    private final JdbcTemplate jdbc;

    JdbcRouteRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Route> FULL_MAPPER = (rs, rowNum) -> new Route(
        rs.getObject("id", UUID.class),
        rs.getString("name"),
        rs.getDouble("avg_speed_kmh"),
        rs.getObject("start_time", OffsetDateTime.class),
        rs.getBoolean("is_public"),
        rs.getObject("created_at", OffsetDateTime.class),
        rs.getString("gpx_content"),
        rs.getString("checkpoints_json"));

    private static final RowMapper<RouteSummary> SUMMARY_MAPPER = (rs, rowNum) -> new RouteSummary(
        rs.getObject("id", UUID.class),
        rs.getString("name"),
        rs.getDouble("avg_speed_kmh"),
        rs.getObject("start_time", OffsetDateTime.class),
        rs.getBoolean("is_public"),
        rs.getObject("created_at", OffsetDateTime.class));

    @Override
    public List<RouteSummary> findAllByUserId(long userId) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at " +
            "FROM routes WHERE user_id = ? ORDER BY created_at DESC",
            SUMMARY_MAPPER, userId);
    }

    @Override
    public Optional<Route> findById(UUID id) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at, gpx_content, checkpoints_json " +
            "FROM routes WHERE id = ?",
            FULL_MAPPER, id).stream().findFirst();
    }

    @Override
    public Optional<Long> findOwnerUserId(UUID id) {
        return jdbc.queryForList(
            "SELECT user_id FROM routes WHERE id = ?", Long.class, id).stream().findFirst();
    }

    @Override
    public Route save(long userId, NewRoute route) {
        UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO routes (id, user_id, name, gpx_content, avg_speed_kmh, start_time, checkpoints_json) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            id, userId, route.name(), route.gpxContent(),
            route.avgSpeedKmh(), route.startTime(), route.checkpointsJson());
        return findById(id).orElseThrow();
    }

    @Override
    public Optional<Route> update(UUID id, RouteUpdate update) {
        List<String> sets = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (update.name() != null) { sets.add("name = ?"); params.add(update.name()); }
        if (update.avgSpeedKmh() != null) { sets.add("avg_speed_kmh = ?"); params.add(update.avgSpeedKmh()); }
        if (update.startTime() != null) { sets.add("start_time = ?"); params.add(update.startTime()); }
        if (update.checkpointsJson() != null) { sets.add("checkpoints_json = ?"); params.add(update.checkpointsJson()); }
        if (sets.isEmpty()) return findById(id);
        sets.add("updated_at = now()");
        params.add(id);
        jdbc.update("UPDATE routes SET " + String.join(", ", sets) + " WHERE id = ?", params.toArray());
        return findById(id);
    }

    @Override
    public void delete(UUID id) {
        jdbc.update("DELETE FROM routes WHERE id = ?", id);
    }

    @Override
    public String share(UUID id, String token) {
        jdbc.update(
            "UPDATE routes SET is_public = true, share_token = ?, updated_at = now() WHERE id = ?",
            token, id);
        return token;
    }

    @Override
    public void unshare(UUID id) {
        jdbc.update(
            "UPDATE routes SET is_public = false, share_token = NULL, updated_at = now() WHERE id = ?",
            id);
    }

    @Override
    public Optional<Route> findByShareToken(String token) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at, gpx_content, checkpoints_json " +
            "FROM routes WHERE share_token = ? AND is_public = true",
            FULL_MAPPER, token).stream().findFirst();
    }

    @Override
    public Optional<String> findShareToken(UUID id) {
        return jdbc.queryForList(
            "SELECT share_token FROM routes WHERE id = ? AND share_token IS NOT NULL AND is_public = true",
            String.class, id).stream().findFirst();
    }
}
