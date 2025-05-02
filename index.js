class NotificationRequest {
    constructor(userId, channels, templateId, params) {
        this.userId = userId;
        this.channels = channels;
        this.templateId = templateId;
        this.params = params;
    }
}

// Rate limiter per user 1 request every 5 seconds
class PerUserRateLimiter {
    constructor(limitDurationMs) {
        this.limitDurationMs = limitDurationMs;
        this.userTimestamps = new Map();
    }

    isAllowed(userId) {
        const currentTime = Date.now();
        const lastTime = this.userTimestamps.get(userId) || 0;
        // console.log(`User: ${userId}, Current Time: ${currentTime}, Last Time: ${lastTime}`);

        if (currentTime - lastTime >= this.limitDurationMs) {
            this.userTimestamps.set(userId, currentTime);
            return true;
        }
        return false;
    }
}

// Global rate limiter to process 10 users every 5 seconds
class GlobalRateLimiter {
    constructor(limitCount, limitDurationMs) {
        this.limitCount = limitCount;
        this.limitDurationMs = limitDurationMs;
        this.timestamps = [];
    }

    isAllowed() {
        const currentTimeInMili = Date.now();
        this.timestamps = this.timestamps.filter(ts => currentTimeInMili - ts < this.limitDurationMs);

        if (this.timestamps.length < this.limitCount) {
            this.timestamps.push(currentTimeInMili);
            return true;
        }
        return false;
    }
}

// Message Queue
class MessageQueue {
    constructor() {
        this.queue = [];
    }

    publish(message) {
        this.queue.push(message);
    }

    consume(callback, globalLimiter) {
        setInterval(async () => {
            if (this.queue.length === 0) return;

            for (let i = 0; i < this.queue.length; i++) {
                const request = this.queue[i];

                if (!globalLimiter.isAllowed()) {
                    console.log(`Delaying request from ${request.userId} due to global rate limit.`);
                    continue;
                }

                this.queue.splice(i, 1);
                await callback(request);
                break;
            }
        }, 200);
    }
}

class EmailService {
    async send(userId, message) {
        console.log(`Sending EMAIL to ${userId}: ${message}`);
    }
}

class SMSService {
    async send(userId, message) {
        console.log(`Sending SMS to ${userId}: ${message}`);
    }
}

class PushService {
    async send(userId, message) {
        console.log(`Sending PUSH to ${userId}: ${message}`);
    }
}

class InAppService {
    async send(userId, message) {
        console.log(`Storing IN-APP notification for ${userId}: ${message}`);
    }
}

class TemplateService {
    async render(templateId, params) {
        switch (templateId) {
            case 'WELCOME':
                return `Hello ${params.name}, welcome to our service!`;
            case 'PASSWORD_RESET':
                return `Hi ${params.name}, click here to reset your password: ${params.resetLink}`;
            case 'ORDER_CONFIRMATION':
                return `Dear ${params.name}, your order #${params.orderId} has been confirmed!`;
            case 'SUBSCRIPTION_RENEWAL':
                return `Hello ${params.name}, your subscription will renew on ${params.renewalDate}.`;
            default:
                return `Hello ${params.name}, we have an update for you.`;
        }
    }
}

// NotificationService
class NotificationService {
    constructor(emailService, smsService, pushService, inAppService, templateService) {
        this.emailService = emailService;
        this.smsService = smsService;
        this.pushService = pushService;
        this.inAppService = inAppService;
        this.templateService = templateService;
    }

    async sendNotification(request) {
        const renderedContent = await this.templateService.render(request.templateId, request.params);

        for (const channel of request.channels) {
            try {
                switch (channel) {
                    case 'email':
                        await this.emailService.send(request.userId, renderedContent);
                        break;
                    case 'sms':
                        await this.smsService.send(request.userId, renderedContent);
                        break;
                    case 'push':
                        await this.pushService.send(request.userId, renderedContent);
                        break;
                    case 'inapp':
                        await this.inAppService.send(request.userId, renderedContent);
                        break;
                    default:
                        console.log(`Unknown channel: ${channel}`);
                }
            } catch (error) {
                console.error(`Error sending notification via ${channel}:`, error);
            }
        }

        return 'notification_id_123';
    }
}

const queue = new MessageQueue();
const perUserLimiter = new PerUserRateLimiter(3000);
const globalLimiter = new GlobalRateLimiter(10, 5000);

const service = new NotificationService(
    new EmailService(),
    new SMSService(),
    new PushService(),
    new InAppService(),
    new TemplateService()
);

queue.consume(async (request) => {
    await service.sendNotification(request);
    console.log('Notification sent for', request.userId);
}, globalLimiter);

function apiGateway(reqBody) {
    const { userId, channel, templateId, params } = reqBody;
    if (!perUserLimiter.isAllowed(userId)) {
        console.log(`Too many requests from ${userId}. Request rejected at API gateway.`);
        return;
    }
    const request = new NotificationRequest(userId, channel, templateId, params);
    queue.publish(request);
    console.log('Request queued for', userId);
}

for (let i = 0; i < 15; i++) {
    const userId = `user${i}`;
    apiGateway({
        userId,
        channel: ['email', 'sms', 'push', 'inapp'],
        templateId: 'WELCOME',
        params: { name: `User${i}` }
    });
}
