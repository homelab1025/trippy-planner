package com.trippyplanner.adapter.web;

import com.trippyplanner.application.CreateRouteCommand;
import com.trippyplanner.application.UpdateRouteCommand;
import com.trippyplanner.domain.model.Route;
import com.trippyplanner.model.CreateRouteRequest;
import com.trippyplanner.model.RouteListItem;
import com.trippyplanner.model.UpdateRouteRequest;

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

    static CreateRouteCommand toCommand(CreateRouteRequest request) {
        return new CreateRouteCommand(request.getName(), request.getAvgSpeedKmh(), request.getStartTime(),
            request.getCheckpointsJson());
    }

    static UpdateRouteCommand toCommand(UpdateRouteRequest request) {
        return new UpdateRouteCommand(request.getName(), request.getAvgSpeedKmh(), request.getStartTime(),
            request.getCheckpointsJson());
    }
}
