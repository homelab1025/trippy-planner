package com.trippyplanner.adapter.web;

import com.trippyplanner.domain.model.Route;
import com.trippyplanner.model.CreateRouteRequest;
import com.trippyplanner.model.RouteListItem;
import com.trippyplanner.model.UpdateRouteRequest;

import java.util.function.UnaryOperator;

final class RouteDtoMapper {

    private RouteDtoMapper() {
        throw new AssertionError();
    }

    static com.trippyplanner.model.Route toDto(Route route, String gpxContent) {
        var dto = new com.trippyplanner.model.Route();
        dto.setId(route.id());
        dto.setName(route.name());
        dto.setAvgSpeedKmh(route.avgSpeedKmh());
        dto.setStartTime(route.startTime());
        dto.setIsPublic(route.isPublic());
        dto.setCreatedAt(route.createdAt());
        dto.setGpxContent(gpxContent);
        dto.setCheckpointsJson(route.checkpointsJson());
        return dto;
    }

    static RouteListItem toListItem(Route route) {
        var dto = new RouteListItem();
        dto.setId(route.id());
        dto.setName(route.name());
        dto.setAvgSpeedKmh(route.avgSpeedKmh());
        dto.setStartTime(route.startTime());
        dto.setIsPublic(route.isPublic());
        dto.setCreatedAt(route.createdAt());
        return dto;
    }

    static Route.Builder toDetails(CreateRouteRequest request) {
        return Route.builder()
            .name(request.getName())
            .avgSpeedKmh(request.getAvgSpeedKmh())
            .startTime(request.getStartTime())
            .checkpointsJson(request.getCheckpointsJson());
    }

    // PATCH semantics: a null field in the request leaves the stored value unchanged
    static UnaryOperator<Route> toChanges(UpdateRouteRequest request) {
        return route -> {
            Route changed = route;
            if (request.getName() != null) {
                changed = changed.withName(request.getName());
            }
            if (request.getAvgSpeedKmh() != null) {
                changed = changed.withAvgSpeedKmh(request.getAvgSpeedKmh());
            }
            if (request.getStartTime() != null) {
                changed = changed.withStartTime(request.getStartTime());
            }
            if (request.getCheckpointsJson() != null) {
                changed = changed.withCheckpointsJson(request.getCheckpointsJson());
            }
            return changed;
        };
    }
}
