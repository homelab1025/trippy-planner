package com.trippyplanner.routes;

import com.trippyplanner.model.CreateRouteRequest;
import com.trippyplanner.model.Route;
import com.trippyplanner.model.RouteListItem;
import com.trippyplanner.model.UpdateRouteRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.*;

@Repository
public class RouteRepository {
    private final JdbcTemplate jdbc;

    public RouteRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final RowMapper<Route> FULL_MAPPER = (rs, rowNum) -> {
        Route r = new Route();
        r.setId(rs.getObject("id", UUID.class));
        r.setName(rs.getString("name"));
        r.setAvgSpeedKmh(rs.getDouble("avg_speed_kmh"));
        r.setStartTime(rs.getObject("start_time", OffsetDateTime.class));
        r.setIsPublic(rs.getBoolean("is_public"));
        r.setCreatedAt(rs.getObject("created_at", OffsetDateTime.class));
        r.setGpxContent(rs.getString("gpx_content"));
        return r;
    };

    private static final RowMapper<RouteListItem> LIST_MAPPER = (rs, rowNum) -> {
        RouteListItem r = new RouteListItem();
        r.setId(rs.getObject("id", UUID.class));
        r.setName(rs.getString("name"));
        r.setAvgSpeedKmh(rs.getDouble("avg_speed_kmh"));
        r.setStartTime(rs.getObject("start_time", OffsetDateTime.class));
        r.setIsPublic(rs.getBoolean("is_public"));
        r.setCreatedAt(rs.getObject("created_at", OffsetDateTime.class));
        return r;
    };

    public List<RouteListItem> findAllByUserId(long userId) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at " +
            "FROM routes WHERE user_id = ? ORDER BY created_at DESC",
            LIST_MAPPER, userId);
    }

    public Optional<Route> findById(UUID id) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at, gpx_content " +
            "FROM routes WHERE id = ?",
            FULL_MAPPER, id).stream().findFirst();
    }

    public Optional<Long> findOwnerUserId(UUID id) {
        return jdbc.queryForList(
            "SELECT user_id FROM routes WHERE id = ?", Long.class, id).stream().findFirst();
    }

    public Route save(long userId, CreateRouteRequest req) {
        UUID id = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO routes (id, user_id, name, gpx_content, avg_speed_kmh, start_time) " +
            "VALUES (?, ?, ?, ?, ?, ?)",
            id, userId, req.getName(), req.getGpxContent(),
            req.getAvgSpeedKmh(), req.getStartTime());
        return findById(id).orElseThrow();
    }

    public Optional<Route> update(UUID id, UpdateRouteRequest req) {
        List<String> sets = new ArrayList<>();
        List<Object> params = new ArrayList<>();
        if (req.getName() != null) { sets.add("name = ?"); params.add(req.getName()); }
        if (req.getAvgSpeedKmh() != null) { sets.add("avg_speed_kmh = ?"); params.add(req.getAvgSpeedKmh()); }
        if (req.getStartTime() != null) { sets.add("start_time = ?"); params.add(req.getStartTime()); }
        if (sets.isEmpty()) return findById(id);
        sets.add("updated_at = now()");
        params.add(id);
        jdbc.update("UPDATE routes SET " + String.join(", ", sets) + " WHERE id = ?", params.toArray());
        return findById(id);
    }

    public void delete(UUID id) {
        jdbc.update("DELETE FROM routes WHERE id = ?", id);
    }

    public String share(UUID id, String token) {
        jdbc.update(
            "UPDATE routes SET is_public = true, share_token = ?, updated_at = now() WHERE id = ?",
            token, id);
        return token;
    }

    public void unshare(UUID id) {
        jdbc.update(
            "UPDATE routes SET is_public = false, share_token = NULL, updated_at = now() WHERE id = ?",
            id);
    }

    public Optional<Route> findByShareToken(String token) {
        return jdbc.query(
            "SELECT id, name, avg_speed_kmh, start_time, is_public, created_at, gpx_content " +
            "FROM routes WHERE share_token = ? AND is_public = true",
            FULL_MAPPER, token).stream().findFirst();
    }

    public Optional<String> findShareToken(UUID id) {
        return jdbc.queryForList(
            "SELECT share_token FROM routes WHERE id = ? AND share_token IS NOT NULL AND is_public = true",
            String.class, id).stream().findFirst();
    }
}
