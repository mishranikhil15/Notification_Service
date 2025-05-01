// Core request type
class NotificationRequest {
    constructor(userId, channels, templateId, params) {
        this.userId = userId;
        this.channels = channels;
        this.templateId = templateId;
        this.params = params;
    }
}

// RateLimiter
class RateLimiter {
    constructor(limitDurationMs) {
        this.limitDurationMs = limitDurationMs;
        this.userTimestamps = new Map();
    }

    isAllowed(userId) {
        const currentTime = Date.now();
        const lastTime = this.userTimestamps.get(userId) || 0;

        if (currentTime - lastTime >= this.limitDurationMs) {
            this.userTimestamps.set(userId, currentTime);
            return true;
        } else {
            return false;
        }
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

    consume(callback) {
        setInterval(() => {
            if (this.queue.length > 0) {
                const msg = this.queue.shift();
                callback(msg);
            }
        }, 5000);
    }
}

// Main NotificationService
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


class EmailService {
    // Use nodemailer or any other service + ses
    async send(userId, message) {
        console.log(`Sending EMAIL to ${userId}: ${message}`);
    }
}

class SMSService {
    //Use twilio or any other service
    async send(userId, message) {
        console.log(`Sending SMS to ${userId}: ${message}`);
    }
}

class PushService {
    async send(userId, message) {
        console.log(`Sending PUSH notification to ${userId}: ${message}`);
    }
}

class InAppService {
    async send(userId, message) {
        console.log(`Storing IN-APP notification for ${userId}: ${message}`);
    }
}

// Instantiate services and queue
const messageQueue = new MessageQueue();
const rateLimiter = new RateLimiter(5000);

const service = new NotificationService(
    new EmailService(),
    new SMSService(),
    new PushService(),
    new InAppService(),
    new TemplateService()
);

function apiGateway(reqBody) {
    const { userId, channel, templateId, params } = reqBody;

    if (!rateLimiter.isAllowed(userId)) {
        console.log('Too many requests. Please wait before trying again.');
        return;
    }

    const request = new NotificationRequest(userId, channel, templateId, params);
    messageQueue.publish(request);
    console.log('Request queued');
}

// Worker consuming from queue
messageQueue.consume(async (request) => {
    await service.sendNotification(request);
    console.log('Notification sent from worker');
});

// Simulated API call
// apiGateway({
//     userId: 'user123',
//     channel: ['email', 'sms'],
//     templateId: 'welcome_msg',
//     params: { name: 'John' }
// });


for (let i = 0; i < 5; i++) {
    apiGateway({
        userId: 'user123',
        channel: ['email', 'sms', 'push', 'inapp'],
        templateId: 'welcome_msg',
        params: { name: 'John' }
    });

}


// Client --> API Gateway --> Message Queue (notifications) --> Worker --> NotificationService