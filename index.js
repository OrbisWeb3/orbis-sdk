/** Ceramic */
import { CeramicClient } from '@ceramicnetwork/http-client';
import { TileDocument } from '@ceramicnetwork/stream-tile';
import { DIDSession } from 'did-session'
import { EthereumAuthProvider, SolanaAuthProvider } from '@ceramicnetwork/blockchain-utils-linking'

/** Lit Protocol */
import LitJsSdk from 'lit-js-sdk'
import { connectLit, generateLitSignature, generateAccessControlConditionsForDMs, encryptDM, encryptPost, decryptString } from "./utils/lit-helpers.js";

/** Internal helpers */
import { indexer } from './lib/indexer-db.js';
import { forceIndex, forceIndexDid, sleep } from "./utils/index.js";

/** Initiate the node URLs for the two networks */
const MAINNET_NODE_URL = "https://node1.orbis.club/";
const TESTNET_NODE_URL = "https://ceramic-clay.3boxlabs.com";

/** Set schemas Commit IDs */
const postSchemaStream = "kjzl6cwe1jw145vf8e3qu3bdm9o4wbe1x9tnq197re4knsywt0e9e8a49phe75n";
const postSchemaCommit = "k3y52l7qbv1frxlrgboamtzkwucrmtszxoluwp4xj6sgixa09aatet6vyd17oyw3k";

const groupSchemaStream = "kjzl6cwe1jw145mgwnp562fyppm4ckwonrd2ghnhge9g3ztd6wmiwgyqu7ngk67";
const groupSchemaCommit = "k3y52l7qbv1frxjzs88isr5diuu5axgofcykxh9j04lf6keott406ewn2uuetrg1s";

const channelSchemaStream = "kjzl6cwe1jw14aiqo5jzao1pb9vnw9zcaown9f524ohdb9wvm06zslvwtmjvqpp";
const channelSchemaCommit = "k3y52l7qbv1fryit9nri2zv040695xizbg145eznz5a3io6hsshdqjfmxeoddpyps";

const profileSchemaStream = "kjzl6cwe1jw147z3fd3tpwhnid3kroebsn9wimfawhcoe09thzudg43semys0dh";
const profileSchemaCommit = "k3y52l7qbv1fry0pkd977c71j6l5fothvvpif8fgtize5flxtryvzml6y03bb6nsw";

const reactionSchemaStream = "kjzl6cwe1jw14a1xm07lqfrpoi25nleamzakwbxp3qyh1ndxe6y2ha1i2stt9pk";
const reactionSchemaCommit = "k3y52l7qbv1fryfhr0hi2k052m8fc7s5nnez8lwvminp57qb1gxe9mveojx0051q8";

const followSchemaStream = "kjzl6cwe1jw146qqj9wfuzefr74q84v2mcoszkmdqgcv34r3b6z4c6o2s8mrd4m";
const followSchemaCommit = "k3y52l7qbv1frxry4p2eosbqo1epmhukymy8e4yn5o4bh29snjllqunf7stdulcsg";

const groupMemberSchemaStream = "kjzl6cwe1jw147b0vp4b9axd7eb6wntvnvbsvqkq5czlpaumirbzoxz3rmof4qc";
const groupMemberSchemaCommit = "k3y52l7qbv1frxvye9emo25p9wlrl49gh5qrxdozdy4d6bx5s5ed9tdlmsh9nln9c";

const conversationSchemaStream = "kjzl6cwe1jw149zcbbtuurfb60l26wrf49uxntln6zuagk4140dtpcevub8o4ac";
const conversationSchemaCommit = "k3y52l7qbv1fryezbkk4ber0ves5rl4yzie3zdehwxqvedr0nwiqb889ufjxnihhc";

const messageSchemaStream = "kjzl6cwe1jw147amc7t931duuxwixltfss7uft7aa4cw7ik4dquprfs2bsgkeso";
const messageSchemaCommit = "k3y52l7qbv1frxvviuvk0llujg13amz5cconsgfnt3yzp1fz35qyf747kjudt57uo";

const notificationsReadSchemaStream = "kjzl6cwe1jw147y7iul21b8xce0h2w0gz4favuj8d9ybxhlwn9lyrnc0t3dbtf4"
const notificationsReadSchemaCommit = "k3y52l7qbv1fry0j9i1hqhbzh43ndgjncprgteh4ries4u57s5gc78lxhqvys17gg"

/** Definition of the Orbis class powering the Orbis SDK */
export class Orbis {

	/** Initiate some values for the class */
	ceramic;
	session;
	api;

  /**
	 * Initialize the SDK by connecting to a Ceramic node, developers can pass their own Ceramic object if the user is
	 * already connected within their application
	 */
	constructor(options) {
		if(options && options.ceramic) {
			/** Initialize the Orbis object using the Ceramic object passed in the option */
			this.ceramic = options.ceramic;
		} else {
			/** Either connect to mainnet or testnet */
			if(options && options.node) {
				this.ceramic = new CeramicClient(options.node);
				console.log("Ceramic: Connected to node: " + options.node);
			} else {
				try {
					this.ceramic = new CeramicClient(MAINNET_NODE_URL);
					console.log("Ceramic: Connected to node: " + MAINNET_NODE_URL);
				} catch(e) {
					console.log("Error creating Ceramic object: ", e);
				}
			}
		}

		/** Create API object that developers can use to query content from Orbis */
		this.api = indexer;

		/** Connect to Lit */
		connectLit();
	}

  /** The connect function will connect to an EVM wallet and create or connect to a Ceramic did */
  async connect(provider, lit = true) {

		/** If provider isn't passed we use window.ethereum */
		if(!provider) {
			if(window.ethereum) {
				console.log("Orbis SDK: You need to pass the provider as an argument in the `connect()` function. We will be using window.ethereum by default.");
				provider = window.ethereum;
			} else {
				alert("An ethereum provider is required to proceed with the connection to Ceramic.");
				return false;
			}
		}

		/** Step 1: Enable Ethereum provider (can be browser wallets or WalletConnect for now) */
		let addresses;
		try {
			addresses = await provider.enable();
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Error enabling Ethereum provider."
			}
		}

		/** Step 2: Create an authProvider object using the address connected */
		let authProvider;
		let address = addresses[0].toLowerCase();
		try {
			authProvider = new EthereumAuthProvider(provider, address)
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Error creating Ethereum provider object for Ceramic."
			}
		}

		/** Step 3: Create a new session for this did */
		let did;
		try {
			/** Expire session in 30 days by default */
			const oneMonth = 60 * 60 * 24 * 31;

			this.session = await DIDSession.authorize(
				authProvider,
				{
					resources: [`ceramic://*`],
					expiresInSecs: oneMonth
				}
			);
			did = this.session.did;
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Error creating a session for the DiD."
			}
		}

		/** Step 3 bis: Store session in localStorage to re-use */
		try {
			const sessionString = this.session.serialize()
			localStorage.setItem("ceramic-session", sessionString);
		} catch(e) {
			console.log("Error creating sessionString: " + e);
		}

		/** Step 4: Assign did to Ceramic object  */
		this.ceramic.did = did;

		/** Step 5 (optional): Initialize the connection to Lit */
		if(lit == true) {
			let _userAuthSig = localStorage.getItem("lit-auth-signature-" + address);
			if(!_userAuthSig || _userAuthSig == "" || _userAuthSig == undefined) {
				try {
					/** Generate the signature for Lit */
					let resLitSig = await generateLitSignature(provider, address);
				} catch(e) {
					console.log("Error connecting to Lit network: " + e);
				}
			} else {
				/** User is already connected, save current accoutn signature in lit-auth-signature object for easy retrieval */
				localStorage.setItem("lit-auth-signature", _userAuthSig);
			}
		}

		/** Step 6: Force index did to retrieve blockchain details automatically */
		let _resDid = await forceIndexDid(this.session.id);

		/** Step 7: Get user profile details */
		let { data, error, status } = await this.getProfile(this.session.id);

		let details;
		if(data) {
			details = data.details;
		} else {
			details = {
				did: this.session.id,
				profile: null
			}
		}

		/** Return result */
		return {
			status: 200,
			did: this.session.id,
			details: details,
			result: "Success connecting to the DiD."
		}
  }

	/** Automatically reconnects to a session stored in localStorage, returns false if there isn't any session in localStorage */
	async isConnected() {
		await this.ceramic;

		/** Check if an existing session is stored in localStorage */
		let sessionString = localStorage.getItem("ceramic-session");
		if(!sessionString) {
			return false;
		}

		/** Connect to Ceramic using the session previously stored */
		try {
			this.session = await DIDSession.fromSession(sessionString, null);
			console.log("Reconnected to Ceramic automatically.");
		} catch(e) {
			console.log("Error reconnecting to Ceramic automatically: " + e);
			return false;
		}

		/** Check if session is expired */
		if(this.session.hasSession && this.session.isExpired) {
			return false;
		}

		/** Session is still valid, connect */
		try {
			this.ceramic.did = this.session.did;
		} catch(e) {
			console.log("Error assigning did to Ceramic object: " + e);
			return false;
		}

		/** Step 6: Get user profile details */
		let { data, error, status } = await this.getProfile(this.session.id);

		let details;
		if(data) {
			details = data.details;
		} else {
			details = {
				did: this.session.id,
				profile: null
			}
		}

		/** Return result */
		return {
			status: 200,
			did: this.session.id,
			details: details,
			result: "Success re-connecting to the DiD."
		}
	}

	/** Test function to check the status of the Solana provider */
	async testConnectSolana() {
		let provider;
		if ('phantom' in window) {
	    provider = window.phantom?.solana;
	  } else {
			console.log("Solana Provider: There isn't any Phantom wallet in this browser.");
		}

		const resp = await provider.connect();
		let address = resp.publicKey.toString();
		console.log("Solana Provider: Found: " + address);

		/** Step 2: Create an authProvider object using the address connected */
		let authProvider;
		try {
			authProvider = new SolanaAuthProvider(provider, address)
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Error creating Solana provider object for Ceramic."
			}
		}

		/** Step 3: Create a new session for this did */
		let did;
		try {
			/** Expire session in 30 days by default */
			const oneMonth = 60 * 60 * 24 * 31;

			this.session = await DIDSession.authorize(
				authProvider,
				{
					resources: [`ceramic://*`],
					expiresInSecs: oneMonth
				}
			);
			did = this.session.did;
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Error creating a session for the DiD."
			}
		}

		/** Step 3 bis: Store session in localStorage to re-use
		try {
			const sessionString = this.session.serialize()
			localStorage.setItem("ceramic-session", sessionString);
		} catch(e) {
			console.log("Error creating sessionString: " + e);
		} */

		/** Step 4: Assign did to Ceramic object  */
		this.ceramic.did = did;
		console.log("Connected to Ceramic using: " + this.session.id);

		/** Step 6: Force index did to retrieve blockchain details automatically */
		let _resDid = await forceIndexDid(this.session.id);

		/** Step 7: Get user profile details */
		let { data, error, status } = await this.getProfile(this.session.id);

		let details;
		if(data) {
			details = data.details;
		} else {
			details = {
				did: this.session.id,
				profile: null
			}
		}

		/** Return result */
		return {
			status: 200,
			did: this.session.id,
			details: details,
			result: "Success connecting to the DiD."
		}
	}

	/** Destroys the Ceramic session string stored in localStorage */
	logout() {
		try {
			localStorage.removeItem("ceramic-session");
			return {
				status: 200,
				result: "Logged out from Orbis and Ceramic."
			}
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Error logging out."
			}
		}

	}

	/** Update user profile */
	async updateProfile(content) {
		/** Create a new stream with those details */
		let result = await this.createTileDocument(content, ["orbis", "profile"], profileSchemaCommit);
		return result;
	}

	/** Save the last read time for notifications for the connected user */
	async setNotificationsReadTime(type, timestamp) {
		/** Create tile with the settings details */
		let result = await this.createTileDocument({last_notifications_read_time: timestamp}, ["orbis", "settings", "notifications", type], notificationsReadSchemaCommit);

		/** Return confirmation results */
		return result;
	}

  /** Connected users can share a new post following our schemas */
  async createPost(content, encryptionRules = null) {
		/** Make sure post isn't empty */
		if(!content || !content.body || content.body == "" || content.body == undefined) {
			return {
				status: 300,
				result: "You can't share an empty post."
			}
		}

		/** Check if posts should be encrypted  */
		let _encryptedContent;
		if(encryptionRules) {
			try {
				_encryptedContent = await encryptPost(encryptionRules, content.body);
				content.encryptedBody = _encryptedContent;
				content.body = "";
			} catch(e) {
				console.log("There was an error encrypting this post: ", e);
				return {
					status: 300,
					error: e,
					result: "There was an error encrypting this post."
				}
			}
		}

		/** Create tile with post schema */
		let result = await this.createTileDocument(content, ["orbis", "post"], postSchemaCommit);

		/** Return confirmation results */
		return result;
  }

	/** Connected users can edit their post */
  async editPost(stream_id, content, encryptionRules = null) {
		/** Make sure post isn't empty */
		if(!content || !content.body || content.body == "" || content.body == undefined) {
			return {
				status: 300,
				result: "You can't share an empty post."
			}
		}

		/** Check if posts should be encrypted  */
		let _encryptedContent;
		if(encryptionRules) {
			try {
				_encryptedContent = await encryptPost(encryptionRules, content.body);
				content.encryptedBody = _encryptedContent;
				content.body = "";
			} catch(e) {
				console.log("There was an error encrypting this post: ", e);
				return {
					status: 300,
					error: e,
					result: "There was an error encrypting this post."
				}
			}
		}

		/** Update tile with post schema */
		let result = await this.updateTileDocument(stream_id, content, ["orbis", "post"], postSchemaCommit);

		/** Return confirmation results */
		return result;
  }

	/** Users can delete one of their post */
	async deletePost(stream_id) {
		/** Update tile with post schema */
		let result = await this.updateTileDocument(stream_id, {is_deleted: true, body: ""}, ["orbis", "post"]);

		/** Return confirmation results */
		return result;
  }

	/** Connected users can react to an existing post */
	async react(post_id, type) {
		/** Require post_id */
		if(!post_id || post_id == undefined) {
			return {
				status: 300,
				result: "`post_id` is required when reacting to a post."
			}
		}

		/** Require post_id */
		if(!type || type == undefined) {
			return {
				status: 300,
				result: "`type` is required when reacting to a post."
			}
		}

		/** Create the content object */
		let content = {
			type: type,
			post_id: post_id
		}

		/** Try to create the stream and return the result */
		let result = await this.createTileDocument(content, ["orbis", "reaction"], reactionSchemaCommit);
		return result;
	}

	/** Users can create or update a new group which can be used as a context when sharing posts */
	async createGroup(content) {
		/** Try to create a new Orbis group stream */
		let result = await this.createTileDocument(content, ["orbis", "group"], groupSchemaCommit);

		/** If group creation was successful we also create the first channel */
		if(result.doc) {

			/** Automatically join group created */
			let joinRes = await this.setGroupMember(result.doc, true);

			let channel_content = {
				group_id: result.doc,
				name: "general",
				type: "feed"
			};

			/** Create a new stream for the channel */
			let channel_result = await this.createChannel(result.doc, channel_content);

			/** Return result */
			return result;

		} else {
			console.log("Error creating the initial channel.");
			return {
				status: 200,
				group_id: result.doc,
				result: "Group created without first channel."
			}
		}
	}

	/** Users can create a channel in a group */
	async createChannel(group_id, content) {
		if(!group_id || group_id == undefined) {
			return {
				status: 300,
				result: "`group_id` is required when creating a channel."
			}
		}

		/** Create channel object */
		let result = await this.createTileDocument(content, ["orbis", "channel"], channelSchemaCommit);
		return result;
	}

	/** User can update a channel */
	async updateChannel(channel_id, content) {
		if(!channel_id) {
			console.log("`channel_id` is required to update a channel.");
			return {
				status: 300,
				result: "`channel_id` is required to update a channel."
			}
		}

		/** Update TileDocument with new content */
		let result = await this.updateTileDocument(channel_id, content, ["orbis", "channel"], channelSchemaCommit);
		return result;
	}

	/** Users can join or leave groups using this function */
	async setGroupMember(group_id, active = true) {
		/** Make sure group_id is available */
		if(!group_id) {
			console.log("`group_id` is required to join/leave a group.");
			return {
				status: 300,
				result: "`group_id` is required to join/leave a group."
			}
		}

		/** Create stream content */
		let content = {
			active: active,
			group_id: group_id
		}

		/** Try to create the stream */
		let result = await this.createTileDocument(content, ["orbis", "group_member"], groupMemberSchemaCommit);
		return result;
	}

	/** Users can follow other users */
	async setFollow(did, active = true) {
		/** Make sure group_id is available */
		if(!did) {
			console.log("`did` is required to follow a user.");
			return {
				status: 300,
				result: "`did` is required to follow a user."
			}
		}

		/** Create stream content */
		let content = {
			active: active,
			did: did
		}

		/** Try to create the stream */
		let result = await this.createTileDocument(content, ["orbis", "follow"], followSchemaCommit);
		return result;
	}

	/** User can update a group */
	async updateGroup(stream_id, content) {
		if(!stream_id) {
			console.log("`stream_id` is required to update a group.");
			return {
				status: 300,
				result: "`stream_id` is required to update a group."
			}
		}

		/** Update TileDocument with new content */
		let result = await this.updateTileDocument(stream_id, content, ["orbis", "group"], groupSchemaCommit);
		return result;
	}

	/** Update a post */
	async updatePost(stream_id, body) {

	}

	/** Create a new conversation */
	async createConversation(content) {
		/** Make sure recipients field isn't empty */
		if(!content || !content.recipients || content.recipients.length == 0) {
			return {
				status: 300,
				error: e,
				result: "You can't create a conversations without recipients."
			}
		}

		/** Add sender to the list of recipients to make sure it can decrypt the messages as well */
		let _content = {...content};
		let recipients = _content.recipients;
		recipients.push(this.session.id);

		/** Create tile */
		let result = await this.createTileDocument(_content, ["orbis", "conversation"], conversationSchemaCommit);

		/** Return confirmation results */
		return result;
	}

	/** Send a direct message in a conversation */
	async sendMessage(content) {
		/** Require `message` */
		if(!content || !content.body || content.body == undefined || content.body == "") {
			return {
				status: 300,
				result: "`message` is required when sending a new message."
			}
		}

		/** Require `conversation_id` */
		if(!content || !content.conversation_id || content.conversation_id == undefined || content.conversation_id == "") {
			return {
				status: 300,
				result: "`conversation_id` is required when sending a new message."
			}
		}

		/** Retrieve list of recipients from conversation_id */
		let conversation;
		try {
			conversation = await this.ceramic.loadStream(content.conversation_id);
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Couldn't load recipients from this `content.conversation_id`"
			}
		}

		/** Make sure recipients array is valid */
		if(!conversation.content?.recipients || conversation.content?.recipients.length <= 0) {
			return {
				status: 300,
				error: "Recipients array is empty or doesn't exist. Please retry or create a new conversation.",
				result: "Couldn't load recipients from this conversation id"
			}
		}

		/** Try to encrypt content */
		let _encryptedContent;
		try {
			_encryptedContent = await encryptDM(conversation.content.recipients, content.body);
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Couldn't encrypt DM."
			}
		}

		/** Create content object */
		let _content = {
			conversation_id: content.conversation_id,
			encryptedMessage: _encryptedContent
		}

		/** Create tile for this message */
		let result = await this.createTileDocument(_content, ["orbis", "message"], messageSchemaCommit);
		return result;
	}

	/** Decrypt an encrypted post using Lit Protocol */
	async decryptPost(content) {
		let res;
		try {
			res = await decryptString(content.encryptedBody);
			return res;
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Error decrypting post."
			}
		}
	}

	/** Decrypt a direct message using Lit Protocol */
	async decryptMessage(content) {
		let res;
		try {
			res = await decryptString(content.encryptedMessage);
			return res;
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Error decrypting message."
			}
		}
	}

	/** NOT AVAILABLE FOR NOW: Users can create or update a new context such as a group or a channel within a group to organize the posts being shared */
	async createContext() {

	}
	async updateContext() {

	}

	/***********************
	*** CERAMIC HELPERS ***
	**********************/

	/** Helper to create a basic TileDocument on Ceramic */
	async createTileDocument(content, tags, schema, family = "orbis") {
		let res;

		/** Try to create TileDocument */
		try {
			let doc = await TileDocument.create(
				this.ceramic,
				/** Content of the post */
				content,
				/** Metadata */
				{
					family: family,
					controllers: [this.session.id],
					tags: tags,
					schema: schema
				},
			);

			/** Force index document */
			forceIndex(doc.id.toString());

			/** Return JSON with doc object */
			res = {
				status: 200,
				doc: doc.id.toString(),
				result: "Success creating TileDocument."
			}
		} catch(e) {
			console.log("Error creating TileDocument: ", e);
			res = {
				status: 300,
				error: e,
				result: "Error creating TileDocument."
			}
		}

		/** Returning result */
		return res;
	}

	/** Helper to update an existing TileDocument */
	async updateTileDocument(stream_id, content, tags, schema, family = "orbis") {
		let res;

		/** Try to update existing Ceramic document */
		let doc;
		try {
			doc = await TileDocument.load(this.ceramic, stream_id);
			await doc.update(content, {
				family: family,
				controllers: [this.session.id],
				tags: tags,
				schema: schema
			});

			/** Force index document */
			forceIndex(stream_id);

			/** Return JSON with doc object */
			res = {
				status: 200,
				doc: stream_id,
				result: "Success updating TileDocument."
			}
		} catch(e) {
			res = {
				status: 300,
				error: e,
				result: "Error updating TileDocument."
			}
		}

		/** Returning result */
		return res;

	}

	/** Helper to create a deterministic TileDocument on Ceramic */
	async deterministicDocument(content, tags, schema, family = "orbis") {
		let res;

		/** Try to create/update a deterministic TileDocument */
		try {
			/** Retrieve or create deterministic document */
			const doc = await TileDocument.deterministic(
	        this.ceramic,
					{
						family: family,
						controllers: [this.session.id],
						tags: tags
					}
	      );

			/** Update the document to add content */
	    await doc.update(
				content,
				{
					family: family,
					controllers: [this.session.id],
					tags: tags
				});

			/** Force index document after a 500ms delay */
			await sleep(500);
			forceIndex(doc.id.toString());

			/** Return JSON with doc object */
			res = {
				status: 200,
				doc: doc.id.toString(),
				result: "Success creating or updating deterministic TileDocument."
			}
		} catch(e) {
			res = {
				status: 300,
				error: e,
				result: "Error creating or updating deterministic TileDocument."
			}
		}

		/** Returning result */
		return res;
	}


	/*******************
	*** API QUERIES ***
	******************/

	/** Check if a user already has active dids with this wallet address and returns profile details if any */
	async getDids(address) {
		let { data, error, status } = await this.api.from("orbis_v_profiles").select().ilike('address', address);

		/** Return results */
		return({ data, error, status });
	}

	/**
	 * Retrieve posts shared in a specific context or by a specific user
	 * Returns an array of posts in the `data` field or an `error`.
	 */
	async getPosts(options, page = 0) {
		let query;

		/** Default query for global feed, developers can pass an algorithm ID to order the posts */
		if(options?.algorithm) {
			switch (options.algorithm) {
				case "recommendations":
					query = this.api.rpc("orbis_recommendations", { user_did: this.session && this.session ? this.session.id : "none" }).range(page * 50, (page + 1) * 50 - 1);
					break;
				case "all-posts":
					query = this.api.rpc("all_posts").range(page * 50, (page + 1) * 50 - 1);
					break;
				case "all-master-posts":
					query = this.api.rpc("all_master_posts").range(page * 50, (page + 1) * 50 - 1);
					break;
				case "all-context-master-posts":
					query = this.api.rpc("all_context_master_posts", { post_context: options?.context }).range(page * 50, (page + 1) * 50 - 1);
					break;
				case "all-posts-non-filtered":
					query = this.api.rpc("all_posts_non_filtered").range(page * 50, (page + 1) * 50 - 1);
					break;
				default:
					query = this.api.from("orbis_v_posts").select().range(page * 50, (page + 1) * 50 - 1).order('timestamp', { ascending: false });
					break;
			}
		}

		/** If user is querying posts from a specific did within a specific context */
		else if(options?.context && options?.did) {
			query = this.api.from("orbis_v_posts").select().eq('context', options.context).eq('creator', options.did).range(page * 50, (page + 1) * 50 - 1).order('timestamp', { ascending: false });
		}

		/** If user is querying posts from a specific context */
		else if(options?.context) {
			query = this.api.from("orbis_v_posts").select().eq('context', options.context).range(page * 50, (page + 1) * 50 - 1).order('timestamp', { ascending: false });
		}

		/** If user is querying posts from a specific profile */
		else if(options?.did) {
			query = this.api.from("orbis_v_posts").select().eq('creator', options.did).range(page * 50, (page + 1) * 50 - 1).order('timestamp', { ascending: false });
		}

		/** If user is querying posts shared as reply of another post */
		else if(options?.master) {
			query = this.api.from("orbis_v_posts").select().eq('master', options.master).range(page * 200, (page + 1) * 200 - 1).order('timestamp', { ascending: true });
		}

		else {
			 query = this.api.from("orbis_v_posts").select().range(page * 50, (page + 1) * 50 - 1).order('timestamp', { ascending: false });
		}

		/** Query indexer */
	  let { data, error, status } = await query;

		/** Return results */
		return({ data, error, status });
	}

	/** Get post details */
	async getPost(post_id) {
		let { data, error, status } = await this.api.from("orbis_v_posts").select().eq('stream_id', post_id).single();

		/** Return results */
		return({ data, error, status });
	}

	/** Get groups */
	async getGroups() {
		let { data, error, status } = await this.api.from("orbis_v_groups").select().order('last_activity_timestamp', { ascending: false });

		/** Return results */
		return({ data, error, status });
	}

	/** Get group details */
	async getGroup(group_id) {
		let { data, error, status } = await this.api.from("orbis_v_groups").select().eq('stream_id', group_id).single();

		/** Return results */
		return({ data, error, status });
	}

	/** Get group details */
	async getGroupMembers(group_id) {
		let { data, error, status } = await this.api.from("orbis_v_members").select().match({group_id: group_id, active: 'true'});

		/** Return results */
		return({ data, error, status });
	}

	/** Check if a user is a member of a group and returns a boolean */
	async getIsGroupMember(group_id, did) {
		let res = false;
		let { data, error, status } = await this.api.from("orbis_group_members").select('stream_id').match({group_id: group_id, did: did, active: 'true'});

		/** Returns `true` if data isn't empty */
		if(data && data.length > 0) {
			res = true;
		}

		/** Return results */
		return({ data: res, error, status });
	}

	/** Get channel details */
	async getChannel(channel_id) {
		let { data, error, status } = await this.api.from("orbis_channels").select().eq('stream_id', channel_id).single();

		/** Return results */
		return({ data, error, status });
	}

	/** Get profile details */
	async getProfile(did) {
		let { data, error, status } = await this.api.from("orbis_v_profiles").select().eq('did', did).single();

		/** Return results */
		return({ data, error, status });
	}

	/** Get profiles matching the usernames passed as a parameter */
	async getProfilesByUsername(username) {
		let { data, error, status } = await this.api.from("orbis_v_profiles").select().ilike('username', username + "%").range(0, 10).order('timestamp', { ascending: false });

		/** Return results */
		return({ data, error, status });
	}

	/** Get groups memberships for a profile */
	async getProfileGroups(did) {
		let { data, error, status } = await this.api.from("orbis_user_groups").select().match({did: did, active: 'true'}).not('group_id',  "is", null);

		/** Return results */
		return({ data, error, status });
	}

	/** Get list of followers for a specific did */
	async getProfileFollowers(did) {
		let { data, error, status } = await this.api.from("orbis_v_followers").select('details:did_following_details').match({did_followed: did, active: 'true'});

		/** Return results */
		return({ data, error, status });
	}

	/** Get list of users being followed by a specific did */
	async getProfileFollowing(did) {
		let { data, error, status } = await this.api.from("orbis_v_followers").select('details:did_followed_details').match({did_following: did, active: 'true'});

		/** Return results */
		return({ data, error, status });
	}

	/** Check if a user is already following another user and returns a boolean */
	async getIsFollowing(did_following, did_followed) {
		let res = false;
		let { data, error, status } = await this.api.from("orbis_v_followers").select().match({did_following: did_following, did_followed: did_followed, active: 'true'});

		/** Returns `true` if data isn't empty */
		if(data && data.length > 0) {
			res = true;
		}

		/** Return results */
		return({ data: res, error, status });
	}

	/** Get conversationv2 details */
	async getConversations(options) {
		let query;

		/** If user is querying conversations from a specific user and context */
		if(options?.context && options?.did) {
			query = this.api.from("orbis_v_conversations").select().eq('context', options.context).filter('recipients', 'cs', '["'+options.did+'"]').order('last_message_timestamp', { ascending: false });
		}

		/** If user is querying conversations for a specific context  */
		else if(options?.context) {
			query = this.api.from("orbis_v_conversations").select().eq('context', options.context).order('last_message_timestamp', { ascending: false });
		}

		/** If user is querying conversations for a specific user  */
		else if(options?.did) {
			query = this.api.from("orbis_v_conversations").select().filter('recipients', 'cs', '["'+options.did+'"]').order('last_message_timestamp', { ascending: false });
		}

		/** Returns error if no did */
		else {
			return({ data: [], error: "The `did` is required when retrieving conversations.", status: 300 });
		}

		/** Return results */
		let { data, error, status } = await query;
		return({ data, error, status });
	}

	/** Get conversation details */
	async getConversation(conversation_id) {
		let { data, error, status } = await this.api.from("orbis_v_conversations").select().eq('stream_id', conversation_id).single();

		/** Return results */
		return({ data, error, status });
	}

	/** Get messages from one conversation */
	async getMessages(conversation_id) {
		let { data, error, status } = await this.api.from("orbis_v_messages").select().eq('conversation_id', conversation_id);

		/** Return results */
		return({ data, error, status });
	}
}
