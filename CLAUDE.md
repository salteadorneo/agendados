# Data event extraction
Locate on /content/events directory and group by year directory. Each event is a markdown file with the following structure:

```markdown
---
title: "Event Title"
description: "Brief description of the event."
start: "YYYY-MM-DD"
end: "YYYY-MM-DD" # Optional, if the event lasts multiple days
startTime: '17:00' # Optional, start time of the event
endTime: '22:00' # Optional, end time of the event
startRecur: '2025-08-01' # Optional, start date for recurring events
daysOfWeek: [6] # Optional, days of the week for recurring events (0=Sunday, 1=Monday, ..., 6=Saturday)
endRecur: '2025-09-01' # Optional, end date for recurring events
location: "Place Name" # Optional, Precise place name, street address, or venue
province: "Province Name" # Optional, spanish province
color: "#HEXCODE" # Optional, primary color for the event
url: "https://event-website.com" # Optional
image: "https://event-image-url.com/image.jpg" # Optional poster image URL
email: "example@example.com" # Optional, contact email
facebook: "https://facebook.com/event" # Optional, Facebook page URL
instagram: "https://instagram.com/event" # Optional, Instagram profile URL
twitter: "https://twitter.com/event" # Optional, Twitter profile URL
youtube: "https://youtube.com/event" # Optional, YouTube channel URL
tiktok: "https://tiktok.com/@event" # Optional, TikTok profile URL
discord: "https://discord.gg/event" # Optional, Discord server invite URL
---

Content of the event, including details about activities, history, and special features.
```