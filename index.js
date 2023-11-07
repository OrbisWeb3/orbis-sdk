/** Ceramic */
import { CeramicClient } from '@ceramicnetwork/http-client';
import { TileDocument } from '@ceramicnetwork/stream-tile';
import { DIDSession } from 'did-session'
import { EthereumWebAuth, getAccountId } from '@didtools/pkh-ethereum'
import { Store } from './store.js';
import axios from 'axios';

/** To generate dids from a Seed */
import { DID } from 'dids'
import { Ed25519Provider } from 'key-did-provider-ed25519'
import { getResolver } from 'key-did-resolver'

/** Lit Protocol */
import {
	connectLitClient,
	generateLitSignature,
	generateLitSignatureV2,
	generateAccessControlConditionsForDMs,
	encryptDM,
	encryptPost,
	decryptString,
	encryptString,
	decryptStringFromAPI,
	encryptStringFromAPI
} from "./utils/lit-helpers.js";

/** Internal helpers */
import { indexer } from './lib/indexer-db.js';
import {
	forceIndex,
	fetchUserCredentials,
	forceIndexDid,
	sleep,
	randomSeed,
	sortByKey,
	getAuthMethod,
	getAddressFromDid,
	resizeFile,
	formatConversation
} from "./utils/index.js";
import { authenticatePkp } from "./utils/ceramic-helpers.js"

/** Initiate the node URLs for the two networks */
const MAINNET_NODE_URL = "https://node2.orbis.club/";
const TESTNET_NODE_URL = "https://ceramic-clay.3boxlabs.com";
let PINATA_GATEWAY = "https://orbis.mypinata.cloud/ipfs/";
let PINATA_API_KEY = null;
let PINATA_SECRET_API_KEY = null;

/** Set schemas Commit IDs */
const postSchemaStream = "kjzl6cwe1jw1498inegtpji0iqf0htspb0qqswlofjy0hak1s3u2pf19qql7oak";
const postSchemaCommit = "k1dpgaqe3i64kjuyet4w0zyaqwamf9wrp1jim19y27veqkppo34yghivt2pag4wxp0fv2ykzc0sppqh7zdmujsr7w11y96ofq0guo5q33p1q54opbvw8hvwnj";

const groupSchemaStream = "kjzl6cwe1jw1487a0xluwl3ip6lcdcfn8ahgomsbf8x5rf65mktdjuouz8xopbf";
const groupSchemaCommit = "k3y52l7qbv1fry2bramzfrq10z2vrywf96yk6n61d8ffsyzvs0k0wd68sanjjo16o";

const projectSchemaStream = "kjzl6cwe1jw14936q0quh7drz7a97gw8yw3aoiflwmgsdlf4prnokwywfhhadfn";
const projectSchemaCommit = "k1dpgaqe3i64kjul5j2lieylhdluzl3wrsae9dgn5n5akr80x6r18pbt68nsg7axlp5pn1warxxgcoq491r9aki0thj6a7goqiogab773qke2w20okq3s94z3";

const contextSchemaStream = "kjzl6cwe1jw147dp34t1t88xu2rfltlats6grzav216ko7ocwqz2fgq8myjw8gw";
const contextSchemaCommit = "k1dpgaqe3i64kjqc8pwu488zrftzkd0fxuex8ou82oc1utpl7nu1168fek2d9d5z00ma9ecmw6x017sievx7htbeaxnsv358ph6kzuyb8pkicv6juxe680910";

const channelSchemaStream = "kjzl6cwe1jw148ehiqrzh9npfr4kk4kyqd4as259yqzcr3i1dnrnm30ck5q0t6f";
const channelSchemaCommit = "k1dpgaqe3i64kjsvqaacts7pw2j419foun3d53gbyiv90gguufsv529yaq55rh0gmo68o5nft4ja7xmrtq9x1is59hn1ibx16d1e5wzg4tdxtutmegh2hy1a6";

const encryptedEmailSchemaStream = "kjzl6cwe1jw147ztpbqz564o0ym42q794j8vf8a9oefny88brcr874jt02j17iw";
const encryptedEmailSchemaCommit = "k3y52l7qbv1fry0ur83jtwrl6uu58zebkw8v3gax0tinebej7mipmaocu8hzclibk";

const profileSchemaStream = "kjzl6cwe1jw145ak5a52cln1i6ztmece01w5qd03dib4lg8i3tt57sjauu14be8";
const profileSchemaCommit = "k1dpgaqe3i64kjl5e5a6qgzaczsht05dra2f5jy2ff8lyk0maaxgnic72oqa21n40kt87t5qi8tu8kyt8xt3bkcirey1it476ptgt2omc66kfnldo1jbs4v9v";

const reactionSchemaStream = "kjzl6cwe1jw146a2jirsoiku1eqsckmk8o7egba22jufwenwbb9fs096s340efk";
const reactionSchemaCommit = "k3y52l7qbv1frxonm2thnyc45m0uhleofxo4ms07iq54h2g9xsg3475tc7q4iumm8";

const followSchemaStream = "kjzl6cwe1jw14av566q7ja9a2jy78uv5ih7pa683ozdulkpsc46qwsxfqzz3po5";
const followSchemaCommit = "k3y52l7qbv1fryl9grzudl4xzm5v7izhj7eersc9m9nmhlfbdi5rzd9przztmejnk";

const groupMemberSchemaStream = "kjzl6cwe1jw146jk7s8ls9bjql42yqn1j5d3z0meue1zkgxeq2drqr0nl43soi8";
const groupMemberSchemaCommit = "k3y52l7qbv1frxqj3rct6wya4d25131fuw65890fdk3y4xkdkpcxxa84nq56zy9kw";

const conversationSchemaStream = "kjzl6cwe1jw149ibyxllm19uiqvaj4gj2f84lq3y3xzs0nqpo2ufw63ut3xwn7i";
const conversationSchemaCommit = "k3y52l7qbv1frybmd4exlop211b2ivzpjl89sqho2k1qf8otyj88h0rff301451c0";

const messageSchemaStream = "kjzl6cwe1jw14bcux0xa3ba15686iwkw78y4xda0djl58ufyq219e116ihujfh8";
const messageSchemaCommit = "k1dpgaqe3i64kk0894kb0j6w3oznbcz99blyot3fjkpl3t12zuj0a05yx15yodie1fnsskh5fmcas76fqqjx98lio3yqhce4za88vpbr7f0eda2oebxsga7hx";

const notificationsReadSchemaStream = "kjzl6cwe1jw14a4hg7d96srbp4tm2lox68ry6uv4m0m3pfsjztxx4pe6rliqquu"
const notificationsReadSchemaCommit = "k3y52l7qbv1fryfzw38e9ccib6qakyi97weer4rhcskd6cwb26sx7lgkw491a6z9c"

/** Definition of the Orbis class powering the Orbis SDK */
export class Orbis {

	/** Initiate some values for the class */
	ceramic;
	litCloud = false;
	session;
	api;
	chain = "ethereum";
	store;

  /**
	 * Initialize the SDK by connecting to a Ceramic node, developers can pass their own Ceramic object if the user is
	 * already connected within their application
	 */
	constructor(options) {
		console.log("Initiating Orbis with options: ", options);
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

		/** Manage storage */
		if(options && options.store) {
			this.store = new Store({
				type: options.store,
				storeAsync: options.storeAsync
			});
		} else {
			/** Try to automatically set the right storage */
			if(typeof Storage !== "undefined") {
				this.store = new Store({type: 'localStorage'})
			} else {
				this.store = new Store({type: 'AsyncStorage'})
			}
		}

		/** Assign Pinata API keys */
		if(options) {
			if(options.PINATA_GATEWAY) {
				PINATA_GATEWAY = options.PINATA_GATEWAY;
			}
			if(options.PINATA_API_KEY) {
				PINATA_API_KEY = options.PINATA_API_KEY;
			}
			if(options.PINATA_SECRET_API_KEY) {
				PINATA_SECRET_API_KEY = options.PINATA_SECRET_API_KEY;
			}
		}

		/** Connect to Lit */
		if(!options || options.useLit != false) {
			console.log("Connecting to Lit.");
			connectLitClient();
		}

		/** Save litCloud if passed as a parameter */
		if(options && options.litCloud == true) {
			this.litCloud = true;
		}

		/** Create API object that developers can use to query content from Orbis */
		this.api = indexer;
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

		/** Step 2: Check if user already has an active account on Orbis */
		let authMethod;
		let defaultChain = "1";
		let address = addresses[0].toLowerCase();
		let accountId = await getAccountId(provider, address)

		/** Check if the user trying to connect already has an existing did on Orbis */
		let {data: existingDids, error: errorDids}  = await this.getDids(address);
		if(existingDids && existingDids.length > 0) {
			let sortedDids = sortByKey(existingDids, "count_followers");
			let _didArr = sortedDids[0].did.split(":");
			let defaultNetwork = _didArr[2];
			if(defaultNetwork == "eip155") {
				defaultChain = _didArr[3];
			}
		}

		/** Update the default accountId used to connect */
		accountId.chainId.reference = defaultChain.toString();

		/** Step 2: Create an authMethod object using the address connected */
		try {
			authMethod = await EthereumWebAuth.getAuthMethod(provider, accountId)
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
			/** Expire session in 90 days by default */
			const threeMonths = 60 * 60 * 24 * 90;

			this.session = await DIDSession.authorize(
				authMethod,
				{
					resources: [`ceramic://*`],
					expiresInSecs: threeMonths
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
			this.store.setItem("ceramic-session", sessionString);
		} catch(e) {
			console.log("Error creating sessionString: " + e);
		}

		/** Step 4: Assign did to Ceramic object  */
		this.ceramic.did = did;

		/** Step 5 (optional): Initialize the connection to Lit */
		if(lit == true) {
			let _userAuthSig = await this.store.getItem("lit-auth-signature-" + address);
			if(!_userAuthSig || _userAuthSig == "" || _userAuthSig == undefined) {
				try {
					/** Generate the signature for Lit */
					let resLitSig = await generateLitSignature(provider, address, "ethereum", this.store);
				} catch(e) {
					console.log("Error connecting to Lit network: " + e);
				}
			} else {
				/** User is already connected, save current accoutn signature in lit-auth-signature object for easy retrieval */
				await this.store.setItem("lit-auth-signature", _userAuthSig);
			}
		}

		/** Step 6: Force index did to retrieve blockchain details automatically */
		forceIndexDid(this.session.id);

		/** Will check if user has new credentials available  */
		fetchUserCredentials(this.session.id);

		/** Step 7: Get user profile details */
		let { data, error, status } = await this.getProfile(this.session.id);

		/** Check if user has configured Lit */
		let hasLit = false;
		let hasLitSig = await this.store.getItem("lit-auth-signature");
		if(hasLitSig) {
			hasLit = true;
		}

		let details;
		if(data) {
			details = data.details;
			details.hasLit = hasLit;
		} else {
			details = {
				did: this.session.id,
				hasLit: hasLit,
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

	/** The connect function will connect to an EVM wallet and create or connect to a Ceramic did */
  async connect_v2({provider, chain = "ethereum", lit = false, oauth = null, appName = null}) {
		/** Save chain we are using in global state */
		this.chain = chain;

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

		/** Variables */
		const threeMonths = 60 * 60 * 24 * 90;
		let did;

		/** Retrieve authMethod and address based on the provider and chain passed as a parameter */
		let { authMethod, address } = await getAuthMethod(provider, chain, appName);

		/** User is connecting with a web2 provider */
		if(provider == 'oauth') {
			/** Generate request variables for API call */
			let oauthData = await fetch("https://lit.orbis.club/assign-pkp", {
	      method: 'POST',
	      headers: { 'Content-Type': 'application/json' },
	      body: JSON.stringify({
	        token: oauth.token,
					code: oauth.code,
	        userId: oauth.userId,
	        authType: oauth.type,
	      })
	    });
			console.log("oauthData:", oauthData);
			let oauthResult = await oauthData.json();
			console.log("oauthResult:", oauthResult);

			/** Request was successful, proceed */
			if(oauthResult.status == 200) {
				/** API generated a new PKP and a session-string, proceed to login the user */
				if(oauthResult.sessionString) {
					console.log("Successfully connected with the PKP, proceed to login the user: ", oauthResult);
					await this.store.setItem("ceramic-session", oauthResult.sessionString);
					await this.store.setItem("lit-auth-signature", oauthResult.authSig);
	        let connectRes = await this.isConnected(oauthResult.sessionString);
					return connectRes;
	      } else {
					if(oauth.type == "email") {
						/** To avoid returning an error when users are verifying the email address (first step for email auth) */
						return oauthResult;
					} else {
						console.log("Error assigning PKP to user.");
						return {
							status: 300,
							error: "Error assigning PKP to user.",
							result: oauthResult
						}
					}
				}
			} else {
				return {
					status: 300,
					error: oauthResult,
					result: "Failed to generate PKP for Oauth method."
				}
			}
		}

		/** User is connecting with a web3 provider */
		else {
			/** Step 3: Create a new session for this did */
			try {
				/** Expire session in 90 days by default */
				this.session = await DIDSession.authorize(
					authMethod,
					{
						resources: [`ceramic://*`],
						expiresInSecs: threeMonths
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
		}

		/** Step 3 bis: Store session in localStorage to re-use */
		try {
			const sessionString = this.session.serialize()
			await this.store.setItem("ceramic-session", sessionString);
		} catch(e) {
			console.log("Error creating sessionString: " + e);
		}

		/** Step 4: Assign did to Ceramic object  */
		this.ceramic.did = did;

		/** Step 5 (optional): Initialize the connection to Lit and generate signature if requested by developer */
		let _userAuthSig = await this.store.getItem("lit-auth-signature-" + address);
		if(_userAuthSig) {
			await this.store.setItem("lit-auth-signature", _userAuthSig);
		}
		if(lit == true && (!_userAuthSig || _userAuthSig == "" || _userAuthSig == undefined)) {
			try {
				/** Generate the signature for Lit */
				let resLitSig = await generateLitSignatureV2(provider, address, chain, this.store);
			} catch(e) {
				console.log("Error connecting to Lit network: " + e);
			}
		}

		/** Step 6: Force index did to retrieve blockchain details automatically */
		forceIndexDid(this.session.id);

		/** Will check if user has new credentials available  */
		fetchUserCredentials(this.session.id);

		/** Step 7: Get user profile details */
		let { data, error, status } = await this.getProfile(this.session.id);

		/** Check if user has configured Lit */
		let hasLit = false;
		let hasLitSig = await this.store.getItem("lit-auth-signature");
		if(hasLitSig) {
			hasLit = true;
		}

		let details;
		if(data) {
			details = data.details;
			details.hasLit = hasLit;
		} else {
			details = {
				did: this.session.id,
				hasLit: hasLit,
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
	async isConnected(sessionString) {
		await this.ceramic;

		/** Check if an existing session is stored in storage */
		if(!sessionString) {
			sessionString = await this.store.getItem("ceramic-session");
			if(!sessionString) {
				return false;
			}
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

		/** Check with which network was this did create with */
		let { address, chain, network } = getAddressFromDid(this.session.id);
		switch (network) {
			case "eip155":
				this.chain = "ethereum";
				break;
			case "solana":
				this.chain = "solana";
				break;
		}

		/** Step 6: Force index did to retrieve blockchain details automatically */
		forceIndexDid(this.session.id);

		/** Step 7: Get user profile details */
		let { data, error, status } = await this.getProfile(this.session.id);

		/** Check if user has configured Lit */
		let _userAuthSig = await this.store.getItem("lit-auth-signature-" + address);
		if(_userAuthSig) {
			await this.store.setItem("lit-auth-signature", _userAuthSig);
		}

		let hasLit = false;
		let hasLitSig = await this.store.getItem("lit-auth-signature");
		if(hasLitSig) {
			hasLit = true;
		}

		let details;
		if(data) {
			details = data.details;
			details.hasLit = hasLit;
		} else {
			details = {
				did: this.session.id,
				hasLit: hasLit,
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

	/** Connect to Lit only (usually in the case the lit signature wasn't generated in the first place) */
	async connectLit(provider) {
		console.log("Enter connectLit()");
		let { address, chain, network } = getAddressFromDid(this.session.id);
		console.log("Retrieved address from Did: ", address);
		switch (network) {
			case "eip155":
				this.chain = "ethereum";
				break;
			case "solana":
				this.chain = "solana";
				break;
		}

		/** Require address */
		if(!address) {
			return {
				status: 300,
				result: "You must pass the address as a parameter in the connectLit function."
			}
		}

		/** If provider isn't passed we use window.ethereum */
		if(!provider) {
			if(window.ethereum) {
				console.log("Orbis SDK: You need to pass the provider as an argument in the `connectLit()` function. We will be using window.ethereum by default.");
				provider = window.ethereum;
			} else {
				alert("An ethereum provider is required to proceed with the connection to Lit Protocol.");
				return {
					status: 300,
					error: e,
					result: "An ethereum provider is required to proceed with the connection to Lit Protocol."
				}
			}
		}

		/** Initialize the connection to Lit */
		try {
			let _userAuthSig = await this.store.getItem("lit-auth-signature-" + address);
			if(!_userAuthSig || _userAuthSig == "" || _userAuthSig == undefined) {
				try {
					/** Generate the signature for Lit */
					let resLitSig = await generateLitSignatureV2(provider, address, this.chain, this.store);
				} catch(e) {
					console.log("Error connecting to Lit network: " + e);
				}
			} else {
				/** User is already connected, save current account signature in lit-auth-signature object for easy retrieval */
				await this.store.setItem("lit-auth-signature", _userAuthSig);
			}

			/** Return success state */
			return {
				status: 200,
				result: "Generated Lit signature for address: " + address
			}
		} catch(e) {
			console.log("Error connecting to Lit network: " + e);

			/** Return result */
			return {
				status: 300,
				error: e,
				result: "Error generating Lit signature."
			}
		}
	}

	/** Destroys the Ceramic session string stored in localStorage */
	logout() {
		try {
			this.store.removeItem("ceramic-session");
			this.store.removeItem("lit-auth-signature");
			this.store.removeItem("lit-auth-sol-signature");
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

	/** Authenticate a did with a seed */
	async connectWithSeed(seed) {
		/** Create the provider and resolve it */
		const provider = new Ed25519Provider(seed);
		const did = new DID({ provider, resolver: getResolver() })

		/** Authenticate the Did */
		await did.authenticate()

		/** Assign did to Ceramic object  */
		this.ceramic.did = did;
		this.session = {
			did: did,
			id: did.id
		};

		/** Return result */
		return {
			status: 200,
			did: did.id,
			details: null,
			result: "Success connecting to the did:key."
		}
	}

	/** Update user profile */
	async updateProfile(content) {
		/** Create a new stream with those details */
		let result = await this.createTileDocument(content, ["orbis", "profile"], profileSchemaCommit);
		return result;
	}

	/** Save the last read time for notifications for the connected user */
	async setNotificationsReadTime(options) {
		let result;
		if(options.context) {
			/** Create tile with the settings details, including context */
			result = await this.createTileDocument({
				last_notifications_read_time: options.timestamp,
				context: options.context
			}, ["orbis", "settings", "notifications", options.type], notificationsReadSchemaCommit);
		} else {
			/** Create tile with the settings details */
			result = await this.createTileDocument({last_notifications_read_time: options.timestamp}, ["orbis", "settings", "notifications", options.type], notificationsReadSchemaCommit);
		}

		/** Return confirmation results */
		return result;
	}

  /** Connected users can share a new post following our schemas */
  async createPost(content, encryptionRules = null) {
		/** User must be connected to call this function. */
		if(!this.session || !this.session.id) {
			console.log("User must be connected to create a post. Make sure to call the connect or isConnected function and to use the same orbis object across your application.");
			return({ data: null, error: "User must be connected to call this function." });
		}

		/** Make sure post isn't empty */
		if(!content || !content.body || content.body == undefined) {
			return {
				status: 300,
				result: "You can't share an empty post."
			}
		}

		/** Check if posts should be encrypted  */
		let _encryptedContent;
		if(encryptionRules && encryptionRules.type) {

			try {
				/** Encrypt the content */
				_encryptedContent = await encryptPost(content.body, encryptionRules);

				/** Save encrypted content in `content` object to be stored in Ceramic */
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
		/** User must be connected to call this function. */
		if(!this.session || !this.session.id) {
			console.log("User must be connected to call this function. Make sure to call the connect or isConnected function and to use the same orbis object across your application.");
			return({ data: null, error: "User must be connected to call this function." });
		}

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
				/** Encrypt the content */
				_encryptedContent = await encryptPost(content.body, encryptionRules);

				/** Save encrypted content in `content` object to be stored in Ceramic */
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
		/** User must be connected to call this function. */
		if(!this.session || !this.session.id) {
			console.log("User must be connected to call this function. Make sure to call the connect or isConnected function and to use the same orbis object across your application.");
			return({ data: null, error: "User must be connected to call this function." });
		}

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
		/** User must be connected to call this function. */
		if(!this.session || !this.session.id) {
			console.log("User must be connected to call this function. Make sure to call the connect or isConnected function and to use the same orbis object across your application.");
			return({ data: null, error: "User must be connected to call this function." });
		}

		/** Try to create a new Orbis group stream */
		let result = await this.createTileDocument(content, ["orbis", "group"], groupSchemaCommit);

		/** If group creation was successful we also create the first channel */
		if(result.doc) {

			/** Automatically join group created */
			let joinRes = await this.setGroupMember(result.doc, true);

			/**let channel_content = {
				group_id: result.doc,
				name: "general",
				type: "feed"
			};

			/** Create a new stream for the channel
			let channel_result = await this.createChannel(result.doc, channel_content);*/

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

	/** Beta: Will create a new notification subscription stream */
	async addNotificationsSubscription(content) {
		/** Make sure value is available */
		if(!content.value) {
			console.log("`value` is required.");
			return {
				status: 300,
				result: "`value` is required."
			}
		}

		/** Encrypt value */
		let { encryptedMessage } = await this.encryptEmail(content.value);

		/** Create stream content */
		content.value = encryptedMessage;

		let result = await this.createTileDocument(content, ["orbis", "notification_subscription"], null);
		return result;
	}

	/** Will encryt the user's email address and store it on Ceramic */
	async setEmail(email) {
		/** Make sure group_id is available */
		if(!email) {
			console.log("`email` is required.");
			return {
				status: 300,
				result: "`email` is required."
			}
		}

		/** Encrypt email address */
		let encryptedEmail = await this.encryptEmail(email);

		/** Create stream content */
		let content = {
			encryptedEmail: encryptedEmail
		}

		/** Try to create the stream */
		let result = await this.createTileDocument(content, ["orbis", "email"], encryptedEmailSchemaCommit);
		return {
			...result,
			encryptedEmail: encryptedEmail
		};
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

	/** Create a new conversation */
	async createConversation(content) {
		try {
			/** Make sure recipients field isn't empty */
			if(!content || !content.recipients || content.recipients.length == 0) {
				return {
					status: 300,
					error: e,
					result: "You can't create a conversations without recipients."
				}
			}

			/** Will format the conversation to return a clean content object */
			/** Add sender to the list of recipients to make sure it can decrypt the messages as well */
		  let _content = {...content};
		  let recipients = _content.recipients;
		  recipients.push(this.session.id);

		  /** If conversation has a name we encrypt it */
			let encryptedConversationName;
		  if(content.name) {
		    let { accessControlConditions, solRpcConditions } = generateAccessControlConditionsForDMs(recipients);
				if(this.litCloud == true) {
					encryptedConversationName = await encryptStringFromAPI(content.name, accessControlConditions, solRpcConditions);
				} else {
					encryptedConversationName = await encryptString(content.name, "ethereum", accessControlConditions);
				}

		    _content.encryptedName = encryptedConversationName;
		    _content.name = "";
		  }

			/** Create tile */
			let result = await this.createTileDocument(_content, ["orbis", "conversation"], conversationSchemaCommit, "orbis", true);

			/** Return confirmation results */
			return result;
		} catch(e) {
			console.log("Error creating conversation:", e);
			return null;
		}

	}

	/** Update an existing conversation */
	async updateConversation(stream_id, content) {

		/** Make sure recipients field isn't empty */
		if(!content || !content.recipients || content.recipients.length == 0) {
			return {
				status: 300,
				error: e,
				result: "You can't update a conversations without recipients."
			}
		}

		/** Will format the conversation to return a clean content object */
		/** Add sender to the list of recipients to make sure it can decrypt the messages as well */
	  let _content = {...content};
	  let recipients = _content.recipients;
	  recipients.push(this.session.id);

	  /** If conversation has a name we encrypt it */
	  if(content.name) {
			let { accessControlConditions, solRpcConditions } = generateAccessControlConditionsForDMs(recipients);
	    let encryptedConversationName;
			if(this.litCloud == true) {
				console.log("Encrypt conversation name with cloud.");
				encryptedConversationName = await encryptStringFromAPI(content.name, accessControlConditions, solRpcConditions);
			} else {
				console.log("Encrypt conversation name with client.");
				encryptedConversationName = await encryptString(content.name, "ethereum", accessControlConditions);
			}

	    _content.encryptedName = encryptedConversationName;
	    _content.name = "";
	  }

		/** Update tile */
		let result = await this.updateTileDocument(stream_id, _content, ["orbis", "conversation"], conversationSchemaCommit, "orbis", true);

		/** Return confirmation results */
		return result;
	}

	/** Send a new message in a conversation */
	async sendMessage(content, data) {
		let res = await this.prepareMessage(null, content, data);
		return res;
	}

	/** Update an existing message in a conversation */
	async updateMessage(stream_id, content, data) {
		let res = await this.prepareMessage(stream_id, content, data);
		return res;
	}

	/** Prepare the direct message being sent */
	async prepareMessage(stream_id, content, data) {
		/** Require `message` */
		if(!content || !content.body || content.body == undefined || content.body == "") {
			return {
				status: 300,
				result: "`body` is required when sending a new message."
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
			let { data: data_conv, error: error_conv } = await this.getConversation(content.conversation_id);

			if(error_conv) {
				console.log("Error retrieving conversation details: ", error_conv);
				return {
					status: 300,
					error: error_conv,
					result: "Error retrieving conversation details."
				}
			}

			/** Save conversation details */
			conversation = data_conv;
			//conversation = await this.ceramic.loadStream(content.conversation_id);
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Couldn't load recipients from this `content.conversation_id`"
			}
		}

		/** Make sure recipients array is valid */
		if(!conversation.recipients || conversation.recipients.length <= 0) {
			return {
				status: 300,
				error: "Recipients array is empty or doesn't exist. Please retry or create a new conversation.",
				result: "Couldn't load recipients from this conversation id"
			}
		}

		/** Try to encrypt content */
		try {
			let { encryptedMessage, encryptedMessageSolana } = await encryptDM(conversation.recipients, content.body, this.litCloud);

			/** Create content object */
			let _content = {
				conversation_id: content.conversation_id,
				encryptedMessage: encryptedMessage,
				encryptedMessageSolana: encryptedMessageSolana
			}

			/** Add custom data field if any */
			if(data) {
				_content.data = data;
			}

			/** Create tile for this message */
			let result;
			if(stream_id) {
				result = await this.updateTileDocument(stream_id, _content, ["orbis", "message"], messageSchemaCommit);
			} else {
				result = await this.createTileDocument(_content, ["orbis", "message"], messageSchemaCommit);
			}

			return result;
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Couldn't encrypt DM."
			}
		}
	}

	/** Function to upload a media to Orbis */
	async uploadMedia(file) {
		console.log("Enter uploadMedia with: ", file);
		/** Making user has setup its Pinata keys */
		if(!PINATA_API_KEY) {
			console.log("You haven't setup your PINATA_API_KEY yet.");
			return {
				status: 300,
				result: "You haven't setup your PINATA_API_KEY yet."
			}
		}

		if(!PINATA_SECRET_API_KEY) {
			console.log("You haven't setup your PINATA_SECRET_API_KEY yet.");
			return {
				status: 300,
				result: "You haven't setup your PINATA_SECRET_API_KEY yet."
			}
		}

		/** Try to upload resized image to IPFS*/
    try {
			const formData = new FormData();
			formData.append("file", file);

			const resFile = await axios({
				method: "post",
				url: "https://api.pinata.cloud/pinning/pinFileToIPFS",
				data: formData,
				headers: {
					'pinata_api_key': PINATA_API_KEY,
					'pinata_secret_api_key': PINATA_SECRET_API_KEY,
					"Content-Type": "multipart/form-data"
				},
			});

			if(resFile.status == 200) {
				return {
					status: 200,
					result: {
		        url: "ipfs://" + resFile.data.IpfsHash,
		        gateway: PINATA_GATEWAY
		      }
				}
			}
    } catch (error) {
      console.log('Error uploading media: ', error)
			return {
				status: 300,
				error: error,
				result: "Error uploading media."
			}
    }
  }

	/** Decrypt an encrypted post using Lit Protocol */
	async decryptPost(content) {
		let res;
		try {
			res = await decryptString(content.encryptedBody, this.chain, this.store);
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
			switch (this.chain) {
				case "ethereum":
					if(this.litCloud == true) {
						res = await decryptStringFromAPI(content.encryptedMessage, this.chain, this.store);
					} else {
						res = await decryptString(content.encryptedMessage, this.chain, this.store);
					}
					break;
				case "solana":
					if(this.litCloud == true) {
						res = await decryptStringFromAPI(content.encryptedMessageSolana, this.chain, this.store);
					} else {
						res = await decryptString(content.encryptedMessageSolana, this.chain, this.store);
					}
					break;
			}
			return res;
		} catch(e) {
			return {
				status: 300,
				error: e,
				result: "Error decrypting message."
			}
		}
	}

	/* Users can create a new project that can be used to organize contexts created */
	async createProject(content) {
		/** User must be connected to call this function. */
		if(!this.session || !this.session.id) {
			console.log("User must be connected to call this function. Make sure to call the connect or isConnected function and to use the same orbis object across your application.");
			return({ data: null, error: "User must be connected to call this function." });
		}

		/** Try to create a new Orbis group stream */
		let result = await this.createTileDocument(content, ["orbis", "project"], projectSchemaCommit);

		/** Return confirmation results */
		return result;
	}

	/** Will update an existing project */
	async updateProject(stream_id, content) {
		if(!stream_id) {
			console.log("`stream_id` is required to update a project.");
			return {
				status: 300,
				result: "`stream_id` is required to update a project."
			}
		}

		/** Update TileDocument with new content */
		let result = await this.updateTileDocument(stream_id, content, ["orbis", "project"], projectSchemaCommit);
		return result;
	}

	/* Users can create a new context which can represent the project or app used by the developer */
	async createContext(content) {
		/** User must be connected to call this function. */
		if(!this.session || !this.session.id) {
			console.log("User must be connected to call this function. Make sure to call the connect or isConnected function and to use the same orbis object across your application.");
			return({ data: null, error: "User must be connected to call this function." });
		}

		/** Try to create a new Orbis group stream */
		let result = await this.createTileDocument(content, ["orbis", "context"], contextSchemaCommit);

		/** Return confirmation results */
		return result;
	}

	/** Will update an existing context */
	async updateContext(stream_id, content) {
		if(!stream_id) {
			console.log("`stream_id` is required to update a context.");
			return {
				status: 300,
				result: "`stream_id` is required to update a context."
			}
		}

		/** Update TileDocument with new content */
		let result = await this.updateTileDocument(stream_id, content, ["orbis", "context"], contextSchemaCommit);
		return result;
	}

	/***********************
	*** CERAMIC HELPERS ***
	**********************/

	/** Helper to create a basic TileDocument on Ceramic */
	async createTileDocument(content, tags, schema, family = "orbis", awaitIndex = false) {

		/** User must be connected to call this function. */
		if(!this.session || !this.session.id) {
			console.log("User must be connected to call this function. Make sure to call the connect or isConnected function and to use the same orbis object across your application.");
			return({ data: null, error: "User must be connected to call this function." });
		}

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

			/** Await for indexing or not */
			if(awaitIndex) {
				await forceIndex(doc.id.toString());
			} else {
				forceIndex(doc.id.toString());
			}


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
	async getPosts(options, page = 0, limit = 50, ascending = false) {
		let query;

		/** Default query for global feed, developers can pass an algorithm ID to order the posts */
		if(options?.algorithm) {
			switch (options.algorithm) {
				case "recommendations":
					query = this.api.rpc("orbis_recommendations", { user_did: this.session && this.session ? this.session.id : "none" }).range(page * limit, (page + 1) * limit - 1);
					break;
				case "all-posts":
					query = this.api.rpc("all_posts").range(page * limit, (page + 1) * limit - 1);
					break;
				case "all-master-posts":
					query = this.api.rpc("all_master_posts").range(page * limit, (page + 1) * limit - 1);
					break;
				case "all-did-master-posts":
					if(options && options.context) {
						query = this.api.rpc("all_did_master_posts_with_context", { post_did: options?.did, post_context: options.context }).range(page * 50, (page + 1) * 50 - 1);
					} else {
						query = this.api.rpc("all_did_master_posts", { post_did: options?.did }).range(page * limit, (page + 1) * limit - 1);
					}
					break;
				case "all-context-master-posts":
					query = this.api.rpc("all_context_master_posts", { post_context: options?.context }).range(page * limit, (page + 1) * limit - 1);
					break;
				case "all-posts-non-filtered":
					query = this.api.rpc("all_posts_non_filtered").range(page * limit, (page + 1) * limit - 1);
					break;
				default:
					query = this.api.from("orbis_v_posts").select().range(page * limit, (page + 1) * limit - 1).order('timestamp', { ascending: ascending });
					break;
			}
		}

		else {
		  query = this.api.rpc("default_posts_09", {
				q_did: options?.did ? options.did : null,
				q_tag: options?.tag ? options.tag : null,
				q_only_master: options?.only_master ? options.only_master : false,
				q_context: options?.context ? options.context : null,
				q_contexts: options?.contexts ? options.contexts : null,
				q_master: options?.master ? options.master : null,
				q_reply_to: options?.reply_to ? options.reply_to : null,
				q_include_child_contexts: options?.include_child_contexts ? options.include_child_contexts : false,
				q_term: options?.term ? options.term : null,
				q_is_reply: options?.is_reply ? options.is_reply : null,
				q_is_repost: options?.is_repost ? options.is_repost : null,
			}).range(page * limit, (page + 1) * limit - 1).order(options?.order_by ? options.order_by : 'timestamp', { ascending: ascending });
		}

		/** Query indexer */
	  let { data, error, status } = await query;

		/** Return results */
		return({ data, error, status });
	}

	/** Get post details */
	async getPost(post_id) {
		let { data, error, status } = await this.api.from("orbis_v_posts_v2").select().eq('stream_id', post_id).single();

		/** Return results */
		return({ data, error, status });
	}

	/** Returns all of the contexts and sub-contexts for a project id */
	async getContexts(project_id) {
		let { data, error, status } = await this.api.rpc('get_contexts_with_children', { project_id: project_id });

		/** Return results */
		return({ data, error, status });
	}

	/** Returns the details of a context */
	async getContext(context_id) {
		let { data, error, status } = await this.api.from("orbis_contexts").select().eq('stream_id', context_id).single();

		/** Return results */
		return({ data, error, status });
	}

	/** Get user reaction for a post */
	async getReaction(post_id, did) {
		let { data, error, status } = await this.api.from("orbis_reactions").select('type').eq('post_id', post_id).eq('creator', did);

		let _reaction = null;
		if(data && data.length > 0) {
			_reaction = data[0];
		}
		/** Return results */
		return({ data: _reaction, error, status });
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
		let { data, error, status } = await this.api.from("orbis_v_profiles").select().ilike('did', did).single();

		/** Return results */
		return({ data, error, status });
	}

	/** Get Verified Credentials from user */
	async getCredentials(did, options) {
	  let q_issuer = null;
		let q_min_weight = 0;
	  let q_offset = 0;

	  if(options) {
	    q_issuer = options.issuer ? options.issuer : null;
			q_min_weight = options.min_weight ? options.min_weight : 0;
			q_offset = options.offset ? options.offset : 0;
	  }

	  let { data, error, status } = await this.api.rpc("get_verifiable_credentials", {
	    q_subject: did,
	    q_min_weight: q_min_weight,
	    q_offset: q_offset
	  });

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

	/** Retrieve notifications based on the options passed as a parameter */
	async getNotifications(options) {
		let query;

		/** Missing type in options */
		if(!options || !options.type) {
			return({ data: null, error: "Query missing type.", status });
		}

		/** User must be connected to access notifications */
		if(!this.session || !this.session.id) {
			return({ data: null, error: "User must be connected to retrieve notifications.", status });
		}

		let { data, error, status } = await this.api.rpc("orbis_f_notifications_02", {
			user_did: this.session.id,
			notif_type: options.type,
			q_context: options.context ? options.context : null,
			q_conversation_id: options.conversation_id ? options.conversation_id : null,
			q_last_read: options.last_read_timestamp ? options.last_read_timestamp : 0,
			q_include_child_contexts: options.include_child_contexts ? options.include_child_contexts : false,
		});

		return({ data, error, status });
	}

	/** Returns count of new notifications for a user (in a specific context or not) */
	async getNotificationsCount(options) {

		/** Missing type in options */
		if(!options || !options.type) {
			return({ data: null, error: "Query missing type." });
		}

		/** User must be connected to access notifications */
		if(!this.session || !this.session.id) {
			return({ data: null, error: "User must be connected to retrieve notifications." });
		}

		let { data, error, status } = await this.api.rpc("orbis_f_count_notifications_02", {
			user_did: this.session.id,
			notif_type: options.type,
			q_context: options.context ? options.context : null,
			q_conversation_id: options.conversation_id ? options.conversation_id : null,
			q_last_read: options.last_read_timestamp ? options.last_read_timestamp : 0,
			q_include_child_contexts: options.include_child_contexts ? options.include_child_contexts : false
		}).single();
		return({ data, error, status });
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
	async getMessages(conversation_id, page = 0) {
		let { data, error, status } = await this.api.from("orbis_v_messages").select().eq('conversation_id', conversation_id).range(page * 50, (page + 1) * 50 - 1);

		/** Return results */
		return({ data, error, status });
	}

	/** Will encrypt the email using the Orbis and User address in access control conditions  */
	async encryptEmail(email) {
		if(!this.session || !this.session.id) {
			console.log("Make sure that user is connected before calling the encryptEmail function.");
			return null;
		}
		let ORBIS_DID = "did:pkh:eip155:1:0xdbcf111ca51572e2f924587faeab857f1e3b824f";

		/** Encrypt email using Lit */
		let encryptedEmail;
		let { accessControlConditions, solRpcConditions } = generateAccessControlConditionsForDMs([this.session.id, ORBIS_DID]);
		if(this.litCloud == true) {
			encryptedEmail = await encryptStringFromAPI(email, accessControlConditions, solRpcConditions);
		} else {
			encryptedEmail = await encryptString(email, "ethereum", accessControlConditions);
		}

		return encryptedEmail;
	}
}

/** Additional exports */
export { generateAccessControlConditionsForDMs, encryptString, decryptString, encryptStringFromAPI, decryptStringFromAPI, connectLitClient };
