export namespace main {
	
	export class PresignedUploadResponse {
	    upload_url: string;
	    object_key: string;
	    public_url: string;
	
	    static createFrom(source: any = {}) {
	        return new PresignedUploadResponse(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.upload_url = source["upload_url"];
	        this.object_key = source["object_key"];
	        this.public_url = source["public_url"];
	    }
	}

}

export namespace models {
	
	export class Channel {
	    id: string;
	    group_id: string;
	    slug: string;
	    name: string;
	    description?: string;
	    channel_type: string;
	    created_by: string;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Channel(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.group_id = source["group_id"];
	        this.slug = source["slug"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.channel_type = source["channel_type"];
	        this.created_by = source["created_by"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class DMConversation {
	    id: string;
	    user1_id: string;
	    user2_identifier: string;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new DMConversation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.user1_id = source["user1_id"];
	        this.user2_identifier = source["user2_identifier"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class Group {
	    id: string;
	    slug: string;
	    name: string;
	    description?: string;
	    created_by: string;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new Group(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.slug = source["slug"];
	        this.name = source["name"];
	        this.description = source["description"];
	        this.created_by = source["created_by"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class GroupMember {
	    id: string;
	    group_id: string;
	    user_identifier: string;
	    joined_at: number;
	
	    static createFrom(source: any = {}) {
	        return new GroupMember(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.group_id = source["group_id"];
	        this.user_identifier = source["user_identifier"];
	        this.joined_at = source["joined_at"];
	    }
	}
	export class Message {
	    id: string;
	    conversation_id: string;
	    sender_id: string;
	    created_at: number;
	    delivered: boolean;
	    channel_id?: string;
	    content?: string;
	    reply_to_message_id?: string;
	    thread_id?: string;
	    is_pinned: boolean;
	
	    static createFrom(source: any = {}) {
	        return new Message(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.conversation_id = source["conversation_id"];
	        this.sender_id = source["sender_id"];
	        this.created_at = source["created_at"];
	        this.delivered = source["delivered"];
	        this.channel_id = source["channel_id"];
	        this.content = source["content"];
	        this.reply_to_message_id = source["reply_to_message_id"];
	        this.thread_id = source["thread_id"];
	        this.is_pinned = source["is_pinned"];
	    }
	}
	export class MessageQueue {
	    id: string;
	    message_id: string;
	    status: string;
	    retry_count: number;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new MessageQueue(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.message_id = source["message_id"];
	        this.status = source["status"];
	        this.retry_count = source["retry_count"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class User {
	    id: string;
	    clerk_id: string;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new User(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.clerk_id = source["clerk_id"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}

}

