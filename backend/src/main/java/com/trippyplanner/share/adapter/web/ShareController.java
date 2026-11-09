package com.trippyplanner.share.adapter.web;

import com.trippyplanner.api.ShareApi;
import com.trippyplanner.model.Route;
import com.trippyplanner.routes.api.RouteQueryService;
import com.trippyplanner.routes.api.SharedRoute;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class ShareController implements ShareApi {

    private final RouteQueryService routeQueryService;

    public ShareController(RouteQueryService routeQueryService) {
        this.routeQueryService = routeQueryService;
    }

    @Override
    public ResponseEntity<Route> getSharedRoute(String shareToken) {
        return routeQueryService.findByShareToken(shareToken)
            .map(sharedRoute -> ResponseEntity.ok(toDto(sharedRoute)))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private static Route toDto(SharedRoute sharedRoute) {
        Route dto = new Route();
        dto.setId(sharedRoute.id());
        dto.setName(sharedRoute.name());
        dto.setAvgSpeedKmh(sharedRoute.avgSpeedKmh());
        dto.setStartTime(sharedRoute.startTime());
        dto.setIsPublic(true);
        dto.setCreatedAt(sharedRoute.createdAt());
        dto.setGpxContent(sharedRoute.gpxContent());
        dto.setCheckpointsJson(sharedRoute.checkpointsJson());
        return dto;
    }
}
