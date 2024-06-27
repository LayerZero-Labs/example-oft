// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// this is a MOCK
contract TokenMock is ERC20 {
    constructor() ERC20("Mock Token", "TKN") {
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals()); // mint 1B to deployoooor
    }

    // this is a MOCK
    function mint(address _to, uint _amount) public {
        _mint(_to, _amount);
    }
}
