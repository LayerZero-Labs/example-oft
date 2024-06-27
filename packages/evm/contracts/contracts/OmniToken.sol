// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import { OFT } from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import { SetConfigParam } from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/IMessageLibManager.sol";
import { EndpointV2 } from "@layerzerolabs/lz-evm-protocol-v2/contracts/EndpointV2.sol";

contract OmniToken is OFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) {}

    function setConfig(address _oapp, address _lib, SetConfigParam[] calldata _params) external onlyOwner {
        EndpointV2(address(endpoint)).setConfig(_oapp, _lib, _params);
    }

    function setSendLibrary(uint32 _eid, address _sendLib) external onlyOwner {
        EndpointV2(address(endpoint)).setSendLibrary(address(this), _eid, _sendLib);
    }

    function setReceiveLibrary(uint32 _eid, address _receiveLib) external onlyOwner {
        EndpointV2(address(endpoint)).setReceiveLibrary(address(this), _eid, _receiveLib, 0);
    }

    function getSendLibrary(uint32 _eid) external view returns (address) {
        return EndpointV2(address(endpoint)).getSendLibrary(address(this), _eid);
    }

    function getReceiveLibrary(uint32 _eid) external view returns (address) {
        (address lib, ) = EndpointV2(address(endpoint)).getReceiveLibrary(address(this), _eid);
        return lib;
    }
}
