// pluto-tv Grayjay Plugin Script
const PLATFORM = "Pluto TV";
const PLUGIN_ID = "7f8a9b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c";

const API_BASE = "https://api.pluto.tv/v2";
const IMAGES_BASE = "https://images.pluto.tv";
const STITCHER_BASE = "https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv";
const STITCHER_BASE2 = "https://cfd-v4-service-channel-stitcher-use1-2.prd.pluto.tv";

let config = {};
let settings = {};

source.enable = function(conf, _settings) {
    config = conf ?? {};
    settings = _settings ?? {};
};

source.saveState = function() {
    return JSON.stringify({});
};

source.getHome = function() {
    try {
        let response = http.GET(`${API_BASE}/channels`, {
            'X-Device-Country': settings.region || 'BR',
            'X-Device-Language': settings.language || 'pt'
        });
        if (!response || !response.isOk) {
            log("Pluto TV: API request failed");
            return new VideoPager([], false, {});
        }

        let data = response.body;
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        let channels = [];
        let seenUrls = new Set();

        if (data && Array.isArray(data)) {
            for (let channel of data) {
                let streamUrl = '';

                // Get HLS stream URL from stitched URLs
                if (channel.stitched && Array.isArray(channel.stitched.urls)) {
                    let hlsUrl = channel.stitched.urls.find(u => u.type === 'hls');
                    if (hlsUrl) {
                        streamUrl = hlsUrl.url;
                    }
                }

                // Fallback: try direct stitched URL if available
                if (!streamUrl && channel.stitched && channel.stitched.sessionURL) {
                    streamUrl = channel.stitched.sessionURL;
                }

                // Only add channel with valid stream URL
                if (streamUrl && !seenUrls.has(streamUrl)) {
                    seenUrls.add(streamUrl);

                    let title = channel.name || 'Pluto TV';
                    let category = channel.category || 'Gerais';
                    let thumbnail = channel.thumbnail?.path || '';
                    let logo = channel.colorLogoSVG || channel.logo?.path || '';

                    // Build description
                    let description = channel.summary || `Pluto TV ${category}`;

                    // Add featured info if available
                    if (channel.featured) {
                        description += `\n\nDestaque:${channel.featuredOrder || ''}`;
                    }

                    channels.push(new PlatformVideo({
                        id: new PlatformID(PLATFORM, channel._id || title, PLUGIN_ID),
                        name: title,
                        thumbnails: new Thumbnails(thumbnail ? [new Thumbnail(thumbnail, 0)] : []),
                        author: new PlatformAuthorLink(
                            new PlatformID(PLATFORM, category, PLUGIN_ID),
                            category,
                            '',
                            ''
                        ),
                        datetime: Math.floor(Date.now() / 1000),
                        url: streamUrl,
                        duration: 0,
                        viewCount: channel.cohortMask ? parseInt(channel.cohortMask) : 0,
                        isLive: true,
                        description: description,
                        rating: null,
                        subtitles: []
                    }));
                }
            }
        }

        log("Pluto TV: Total home channels: " + channels.length);
        return new VideoPager(channels, false, {});
    } catch (e) {
        log("Pluto TV: Error in getHome: " + e);
        return new VideoPager([], false, {});
    }
};

source.searchSuggestions = function(query) {
    return [];
};

source.getSearchCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Relevance],
        filters: []
    };
};

source.search = function(query, type, order, filters) {
    try {
        let response = http.GET(`${API_BASE}/channels`, {
            'X-Device-Country': settings.region || 'BR',
            'X-Device-Language': settings.language || 'pt',
            'q': query
        });
        if (!response || !response.isOk) return new VideoPager([], false, {});

        let data = response.body;
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        let videos = [];
        let seenUrls = new Set();
        let lowerQuery = (query || '').toLowerCase();

        if (data && Array.isArray(data)) {
            for (let channel of data) {
                let streamUrl = '';

                if (channel.stitched && Array.isArray(channel.stitched.urls)) {
                    let hlsUrl = channel.stitched.urls.find(u => u.type === 'hls');
                    if (hlsUrl) {
                        streamUrl = hlsUrl.url;
                    }
                }

                if (!streamUrl && channel.stitched && channel.stitched.sessionURL) {
                    streamUrl = channel.stitched.sessionURL;
                }

                if (!streamUrl) continue;

                // Check if query matches channel name, category, or summary
                let matches = false;
                if (channel.name && channel.name.toLowerCase().includes(lowerQuery)) matches = true;
                if (channel.category && channel.category.toLowerCase().includes(lowerQuery)) matches = true;
                if (channel.summary && channel.summary.toLowerCase().includes(lowerQuery)) matches = true;

                // Check if it's a match and not already added
                if (matches && streamUrl && !seenUrls.has(streamUrl)) {
                    seenUrls.add(streamUrl);

                    let title = channel.name || 'Pluto TV';
                    let thumbnail = channel.thumbnail?.path || '';
                    let logo = channel.colorLogoSVG || channel.logo?.path || '';
                    let category = channel.category || 'Gerais';

                    // Build description
                    let description = channel.summary || `Pluto TV ${category}`;

                    videos.push(new PlatformVideo({
                        id: new PlatformID(PLATFORM, channel._id || title, PLUGIN_ID),
                        name: title,
                        thumbnails: new Thumbnails(thumbnail ? [new Thumbnail(thumbnail, 0)] : []),
                        author: new PlatformAuthorLink(
                            new PlatformID(PLATFORM, category, PLUGIN_ID),
                            category,
                            '',
                            ''
                        ),
                        datetime: Math.floor(Date.now() / 1000),
                        url: streamUrl,
                        duration: 0,
                        viewCount: 0,
                        isLive: true,
                        description: description,
                        rating: null,
                        subtitles: []
                    }));
                }
            }
        }

        log("Pluto TV: Search results: " + videos.length);
        return new VideoPager(videos, false, {});
    } catch (e) {
        log("Pluto TV: Error in search: " + e);
        return new VideoPager([], false, {});
    }
};

source.getSearchChannelContentsCapabilities = function() {
    return {
        types: [Type.Feed.Mixed],
        sorts: [Type.Order.Relevance],
        filters: []
    };
};

source.searchChannelContents = function(channelUrl, query, type, order, filters) {
    return new VideoPager([], false, {});
};

source.searchChannels = function(query) {
    return new ChannelPager([], false, {});
};

source.isChannelUrl = function(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('pluto.tv') || url.includes('api.pluto.tv');
};

source.getChannel = function(url) {
    return new PlatformChannel({
        id: new PlatformID(PLATFORM, url, PLUGIN_ID),
        name: "Pluto TV",
        thumbnail: "",
        banner: "",
        subscribers: 0,
        description: "Video streaming platform",
        url: url,
        links: {}
    });
};

source.getChannelCapabilities = function() {
    return {
        types: [Type.Feed.Videos],
        sorts: []
    };
};

source.getChannelContents = function(url, type, order, filters) {
    return source.getHome();
};

source.isContentDetailsUrl = function(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('pluto.tv') || url.includes('api.pluto.tv') || url.includes('master.m3u8');
};

source.getContentDetails = function(url) {
    try {
        // Extract channel ID from URL if available
        let channelId = null;
        let match = url.match(/\/channel\/([a-f0-9-]+)/);
        if (match) {
            channelId = match[1];
        }

        // Fetch channel data from API
        let response = http.GET(`${API_BASE}/channels`, {
            'X-Device-Country': settings.region || 'BR',
            'X-Device-Language': settings.language || 'pt'
        });
        if (!response || !response.isOk) {
            throw new UnavailableException("Could not fetch channel data");
        }

        let data = response.body;
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        // Find the matching channel
        let channel = null;
        if (data && Array.isArray(data)) {
            channel = data.find(c => c._id === channelId || c.name === url || c.slug === url);
        }

        if (!channel) {
            // Try to find by partial match
            if (data && Array.isArray(data)) {
                channel = data.find(c => c.name.toLowerCase().includes(url.toLowerCase()) || c.category.toLowerCase().includes(url.toLowerCase()));
            }
        }

        if (!channel) {
            throw new UnavailableException("Channel not found");
        }

        // Get stream URL
        let streamUrl = '';
        if (channel.stitched && Array.isArray(channel.stitched.urls)) {
            let hlsUrl = channel.stitched.urls.find(u => u.type === 'hls');
            if (hlsUrl) {
                streamUrl = hlsUrl.url;
            }
        }

        if (!streamUrl) {
            throw new UnavailableException("No stream URL available for this channel");
        }

        let title = channel.name || 'Pluto TV';
        let category = channel.category || 'Gerais';
        let thumbnail = channel.thumbnail?.path || '';
        let logo = channel.colorLogoSVG || channel.logo?.path || '';
        let summary = channel.summary || '';

        // Build description with available info
        let description = summary || `Pluto TV ${category}`;

        // Get HLS source for live playback
        const hlsSource = new HLSSource({
            url: streamUrl,
            name: title,
            duration: 0
        });

        const result = new PlatformVideoDetails({
            id: new PlatformID(PLATFORM, channel._id || title, PLUGIN_ID),
            name: title,
            thumbnails: new Thumbnails([new Thumbnail(thumbnail || `https://images.pluto.tv/channels/${channel._id}/thumbnail.jpg`, 0)]),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, category, PLUGIN_ID),
                category,
                '',
                ''
            ),
            datetime: Math.floor(Date.now() / 1000),
            url: url,
            duration: 0,
            viewCount: 0,
            isLive: true,
            description: description,
            video: new VideoSourceDescriptor([], [], hlsSource),
            rating: null,
            subtitles: []
        });

        // Add content recommendations function
        result.getContentRecommendations = function() {
            return source.getContentRecommendations(url);
        };

        return result;
    } catch (e) {
        if (e instanceof UnavailableException) {
            throw e;
        }
        log("Pluto TV: Error in getContentDetails: " + e);
        throw new UnavailableException("Error loading channel: " + e.message);
    }
};

source.getContentRecommendations = function(url) {
    try {
        let response = http.GET(`${API_BASE}/channels`, {
            'X-Device-Country': settings.region || 'BR',
            'X-Device-Language': settings.language || 'pt'
        });
        if (!response || !response.isOk) {
            return new ContentPager([], false, {});
        }

        let data = response.body;
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        let recommendations = [];
        let seenUrls = new Set();
        seenUrls.add(url); // Exclude current channel

        if (data && Array.isArray(data)) {
            // Group channels by category
            let categories = {};
            for (let channel of data) {
                let category = channel.category || 'Gerais';
                if (!categories[category]) {
                    categories[category] = [];
                }
                categories[category].push(channel);
            }

            // Add channels from same category first
            let currentCategory = null;
            if (data && Array.isArray(data)) {
                for (let channel of data) {
                    if (channel._id && channel._id.toString() === url.split('/').pop() || channel.name.toLowerCase().includes(url.toLowerCase())) {
                        currentCategory = channel.category;
                        break;
                    }
                }
            }

            if (currentCategory && categories[currentCategory]) {
                for (let channel of categories[currentCategory]) {
                    if (channel._id && channel._id.toString() === url.split('/').pop()) continue; // Skip current

                    let streamUrl = '';
                    if (channel.stitched && Array.isArray(channel.stitched.urls)) {
                        let hlsUrl = channel.stitched.urls.find(u => u.type === 'hls');
                        if (hlsUrl) {
                            streamUrl = hlsUrl.url;
                        }
                    }

                    if (streamUrl && !seenUrls.has(streamUrl)) {
                        seenUrls.add(streamUrl);
                        let title = channel.name || category;
                        let thumb = channel.thumbnail?.path || '';

                        recommendations.push(new PlatformVideo({
                            id: new PlatformID(PLATFORM, channel._id || title, PLUGIN_ID),
                            name: title,
                            thumbnails: new Thumbnails(thumb ? [new Thumbnail(thumb, 0)] : []),
                            author: new PlatformAuthorLink(
                                new PlatformID(PLATFORM, category, PLUGIN_ID),
                                category,
                                '',
                                ''
                            ),
                            datetime: Math.floor(Date.now() / 1000),
                            url: streamUrl,
                            duration: 0,
                            viewCount: 0,
                            isLive: true,
                            description: channel.summary || `Pluto TV ${category}`,
                            rating: null,
                            subtitles: []
                        }));

                        if (recommendations.length >= 10) break;
                    }
                }
            }

            // Fill remaining with other categories
            if (recommendations.length < 10) {
                for (let cat of Object.keys(categories)) {
                    if (cat === currentCategory) continue;
                    for (let channel of categories[cat]) {
                        let streamUrl = '';
                        if (channel.stitched && Array.isArray(channel.stitched.urls)) {
                            let hlsUrl = channel.stitched.urls.find(u => u.type === 'hls');
                            if (hlsUrl) {
                                streamUrl = hlsUrl.url;
                            }
                        }

                        if (streamUrl && !seenUrls.has(streamUrl)) {
                            seenUrls.add(streamUrl);
                            let title = channel.name || cat;
                            let thumb = channel.thumbnail?.path || '';

                            recommendations.push(new PlatformVideo({
                                id: new PlatformID(PLATFORM, channel._id || title, PLUGIN_ID),
                                name: title,
                                thumbnails: new Thumbnails(thumb ? [new Thumbnail(thumb, 0)] : []),
                                author: new PlatformAuthorLink(
                                    new PlatformID(PLATFORM, cat, PLUGIN_ID),
                                    cat,
                                    '',
                                    ''
                                ),
                                datetime: Math.floor(Date.now() / 1000),
                                url: streamUrl,
                                duration: 0,
                                viewCount: 0,
                                isLive: true,
                                description: channel.summary || `Pluto TV ${cat}`,
                                rating: null,
                                subtitles: []
                            }));

                            if (recommendations.length >= 10) break;
                        }
                    }
                    if (recommendations.length >= 10) break;
                }
            }
        }

        log("Pluto TV: Recommendations: " + recommendations.length);
        return new ContentPager(recommendations, false, {});
    } catch (e) {
        log("Pluto TV: Error in getContentRecommendations: " + e);
        return new ContentPager([], false, {});
    }
};

source.getComments = function(url) {
    return new CommentPager([], false, {});
};

source.getSubComments = function(comment) {
    return new CommentPager([], false, {});
};

// Helper function to format duration
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}