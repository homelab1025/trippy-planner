package com.trippyplanner.adapter.web;

import com.trippyplanner.model.CreateRouteRequest;
import com.trippyplanner.model.RouteListItem;
import com.trippyplanner.model.UpdateRouteRequest;
import com.trippyplanner.domain.model.NewRoute;
import com.trippyplanner.domain.model.Route;
import com.trippyplanner.domain.model.RouteSummary;
import com.trippyplanner.domain.model.RouteUpdate;

final class RouteDtoMapper {

    private RouteDtoMapper() {
        throw new AssertionError();
    }

    static com.trippyplanner.model.Route toDto(Route route) {
        var dto = new com.trippyplanner.model.Route();
        dto.setId(route.id());
        dto.setName(route.name());
        dto.setAvgSpeedKmh(route.avgSpeedKmh());
        dto.setStartTime(route.startTime());
        dto.setIsPublic(route.isPublic());
        dto.setCreatedAt(route.createdAt());
        dto.setGpxContent(route.gpxContent());
        dto.setCheckpointsJson(route.checkpointsJson());
        return dto;
    }

    static com.trippyplanner.model.Route toSharedDto(Route route) {
        com.trippyplanner.model.Route dto = toDto(route);
        dto.setIsPublic(true);
        return dto;
    }

    static RouteListItem toDto(RouteSummary summary) {
        var dto = new RouteListItem();
        dto.setId(summary.id());
        dto.setName(summary.name());
        dto.setAvgSpeedKmh(summary.avgSpeedKmh());
        dto.setStartTime(summary.startTime());
        dto.setIsPublic(summary.isPublic());
        dto.setCreatedAt(summary.createdAt());
        return dto;
    }

    static NewRoute toDomain(CreateRouteRequest request) {
        return new NewRoute(request.getName(), request.getGpxContent(), request.getAvgSpeedKmh(),
            request.getStartTime(), request.getCheckpointsJson());
    }

    static RouteUpdate toDomain(UpdateRouteRequest request) {
        return new RouteUpdate(request.getName(), request.getAvgSpeedKmh(), request.getStartTime(),
            request.getCheckpointsJson());
    }
}
